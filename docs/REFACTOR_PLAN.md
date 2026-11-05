# Overflow Scout v1.0 — Refactor & Launch Plan

> Status: **Approved 2026-11-04 (all recommendations in §14 accepted)** · Phases 0–4 done · Owner: Basel Issmail
> Scope: Take Overflow Scout from prototype (v0.1) to a Chrome Web Store–ready v1.0 that is accurate, fast, private, and a pleasure to use.

---

## 0. Summary

**What we're building:** A developer tool that finds text that gets cut off — _before_ users or translators hit it. It answers three questions:

1. **What's broken right now?** Non-destructive scan for text that's currently clipped, truncated, or causing horizontal scroll.
2. **What breaks with longer text?** Stress test: grow every string in place to realistic translation lengths (or pseudo-locale), then show what _becomes_ broken.
3. **How much room does this element have?** Inspect an element, find its exact breaking point ("fits up to 18 characters"), and get a CSS fix the tool has **tested** on the live page.

**Why it can win:** The only Chrome pseudo-localization extension we found (PseudoLocalizer) is Manifest V2 and was last updated in 2017. Firefox's Pseudolocalize add-on only expands text and doesn't detect anything. No tool measures, explains, and verifies fixes in one place.

#### Key decisions (details and alternatives in §14)

| Area          | Decision                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework     | **WXT** (replaces CRXJS)                                                                                                                        |
| UI            | **React 19 + TypeScript + Tailwind v4 + Radix/shadcn primitives**, in Chrome's **Side Panel**                                                   |
| Permissions   | `activeTab` + `scripting` + `sidePanel` + `storage` + `contextMenus`. **No host permissions** at install.                                       |
| Measurement   | **In place, on the real element** (no clones). Nodes are never replaced: only `nodeValue` changes, with lossless revert.                        |
| Privacy       | Everything runs locally. No network calls, no analytics.                                                                                        |
| Quality gates | ≥95% precision and ≥95% recall on an annotated fixture corpus (60+ cases) · lossless-revert invariant · axe clean · perf budgets enforced in CI |

---

## 1. Product definition

### 1.1 Users and jobs

| User                           | Job to be done                                                        |
| ------------------------------ | --------------------------------------------------------------------- |
| Frontend engineer              | "Will this component survive German/Finnish copy or a long username?" |
| QA engineer                    | "Find every truncation on this page and file bugs with evidence."     |
| Designer / design-systems team | "Which components lack overflow handling?"                            |
| Localization PM                | "Pseudo-localize staging before we pay for translation."              |

### 1.2 Single purpose (Chrome Web Store requirement)

> _Find, explain, and fix text overflow and truncation on web pages._

Every feature must serve this sentence. Anything that doesn't is out.

### 1.3 v1.0 scope

- **Scan** (non-destructive): clipped text, ellipsis/line-clamp truncation, visible spill, input value/placeholder overflow, and elements causing horizontal page scroll.
- **Stress test** (in place, reversible): Translation-length, Pseudo-locale, Long-words, and Language-samples strategies. Three intensities and an RTL toggle. The result splits into **"Broken now"** and **"Breaks with longer text"**.
- **Inspect**: pick an element; live fit meter; length slider; automatic **breaking point**; preset text pools; custom text.
- **Diagnose**: likely cause with evidence, and **verified fixes** (applied temporarily, re-measured, reported as resolves or doesn't).
- **Report**: copy as Markdown (GitHub/Jira-ready), screenshot cropped to the element, JSON export, ignore rules.
- **Demo page** bundled in the extension, with intentional bugs. Used for onboarding, store screenshots, and e2e tests.
- Keyboard shortcut (`chrome.commands`) and a right-click "Inspect text overflow here".

### 1.4 Non-goals for v1

Canvas/WebGL text · cross-origin iframes (we report how many were skipped) · automatic code changes in the user's repo · team/cloud features · mobile.

### 1.5 Post-v1 roadmap (§9, Phase 8)

Real translation preview via Chrome's on-device Translator API · viewport sweep · Firefox · **`@overflow-scout/core` + a Playwright matcher for CI** (the long-term moat).

---

## 2. Architecture

### 2.1 Stack

| Concern             | Choice                                                                                                                                                       | Why                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension framework | WXT                                                                                                                                                          | Actively maintained. Multi-browser, built-in zip and store publishing, i18n, storage wrapper, shadow-root content UI helpers. Its comparison page marks Plasmo as near maintenance mode and CRXJS as partly maintained. |
| Language            | TypeScript (strictest settings, §6.1)                                                                                                                        |                                                                                                                                                                                                                         |
| Side panel UI       | React 19, Tailwind v4, Radix primitives via shadcn/ui, Lucide icons, TanStack Virtual                                                                        | Accessible primitives, fast iteration, and good coverage by the Claude UI skills (§11)                                                                                                                                  |
| Page overlay        | Vanilla TS in a shadow root                                                                                                                                  | Must stay tiny and must not inject React into user pages                                                                                                                                                                |
| Messaging           | A typed request/reply protocol over one long-lived `chrome.tabs.connect` port between panel and page; **zod** (`zod/mini`) validation at every boundary      | Typed contracts; untrusted input is never used unvalidated                                                                                                                                                              |
| Selectors           | `@medv/finder`                                                                                                                                               | Short, unique, stable selectors                                                                                                                                                                                         |
| Tests               | Vitest (unit), **Vitest Browser Mode** with the Playwright provider (engine, real layout), Playwright (e2e with the built extension), `@axe-core/playwright` | Layout can't be tested in jsdom                                                                                                                                                                                         |
| Tooling             | pnpm, TypeScript 6.0, ESLint 10 (flat config), Prettier, lefthook, commitlint, size-limit, Dependabot                                                        | Version pins explained in ADR 0006                                                                                                                                                                                      |
| Release             | release-please (Conventional Commits) and `wxt submit` from GitHub Actions                                                                                   |                                                                                                                                                                                                                         |

### 2.2 Permission model

```text
permissions:          activeTab, scripting, sidePanel, storage, contextMenus
optional_host_permissions: ["http://*/*", "https://*/*"]   # requested per-origin only, on user request
minimum_chrome_version: "142"   # sidePanel.close / onOpened (141), onClosed (142)
```

- Clicking the toolbar button opens the side panel and grants `activeTab` for that tab. The service worker opens the panel from `action.onClicked` (not `openPanelOnActionClick`), the documented activeTab gesture (spike S1). The shortcut (⌥⇧O) and the context menu grant it too. Nothing runs on any page until the user asks.
- **"Always allow on this site"** (opt-in, per origin) lets the panel re-scan after navigation without another click. It uses `chrome.permissions.request({ origins: [origin] })` from a user gesture in the panel.
- Result: no "read and change all your data" warning at install, a faster store review, and no "reload the page" errors.

### 2.3 Runtime topology

```text
┌──────────── Toolbar click / ⌥⇧O / right-click ───────────┐
│                                                           │
▼                                                           │
Service worker (stateless)                                  │
  • opens side panel (sidePanel.open / openPanelOnActionClick)
  • injects runtime on demand (scripting.executeScript)     │
  • captureVisibleTab for screenshots, context menu, commands
        │ inject                                            │
        ▼                                                   │
Page runtime (isolated world, injected on demand)  ◄──port──┤ Side panel (React app)
  • core engine: collect → measure → diagnose → group       │   • Scan / Stress / Inspect / Report / Settings
  • stress ledger (lossless write/revert)                   │   • virtualized results, detail, fixes
  • overlay + picker in ONE shadow root                     │   • settings via typed storage
  • auto-revert on port disconnect / navigation             │
```

- **Panel ↔ page talk directly over a port** (`chrome.tabs.connect`). The service worker stays out of the hot path, so its suspension can't break a session.
- **Panel closes / tab changes / page navigates → auto-revert + remove overlay.** The user's page is never left modified.
- The service worker holds no state; per-tab session metadata lives in `chrome.storage.session`.

### 2.4 Source layout

```text
src/
  entrypoints/
    background.ts            # SW: panel behavior, injection, commands, context menu, capture
    sidepanel/               # React app (index.html, main.tsx, App.tsx)
    scout.content/           # on-demand runtime (registration: 'runtime')
    demo/                    # bundled demo page with intentional overflow bugs
  core/                      # PURE TS: no chrome.*, no React. Future npm package.
    collect/                 # text-node walker, visibility, open/closed shadow roots, inputs
    measure/                 # self / ancestor-clip / spill / page-overflow / input measurement
    diagnose/                # cause analysis + verified-fix trials
    stress/                  # strategies, ledger (write/revert), breaking-point search
    text/                    # generators, presets, pseudo-locale, seeded RNG, expansion table
    group/                   # component fingerprints, grouping, ignore rules
    select/                  # selector + human label generation
  runtime/                   # page glue: session, port handler, overlay, picker
  messaging/                 # protocol definitions + zod schemas (single source of truth)
  features/                  # side panel feature slices: scan, stress, inspect, report, settings
  ui/                        # design system: tokens.css, primitives, patterns
  storage/                   # typed, versioned storage items + migrations
  locales/                   # i18n (en at launch)
tests/
  fixtures/                  # overflow corpus pages, annotated with data-expect
  engine/                    # Vitest browser-mode suites
  e2e/                       # Playwright with the built extension
docs/
  ARCHITECTURE.md  adr/  PRIVACY.md  (this plan)
```

**Boundary rules (enforced by `eslint-plugin-boundaries`):** `core` imports nothing outside `core`. `features`/`ui` never import `runtime`. Contexts talk to each other only through `messaging`.

### 2.5 Invariants

1. **Never pollute the page.** No attributes, classes, or styles are added to page elements. Identity is tracked in `WeakMap`s. All our UI lives inside one `<overflow-scout-root>` shadow host.
2. **Never replace page nodes.** Stress and inspect change only `Text.nodeValue`, `input.value`, and `placeholder`. React, Vue, and Svelte keep their node references, so nothing crashes on re-render.
3. **Lossless revert.** After any session, the page DOM (excluding our host) is byte-identical to before. Tested on every fixture.
4. **Never render untrusted strings as HTML.** Lint-enforced (§6.3).
5. **The extension stays on the user's device.** No network calls, no remote code.

---

## 3. Detection engine (core)

### 3.1 Candidate collection

- `TreeWalker` over **text nodes**, not CSS selectors. Each non-whitespace text node maps to its nearest element (its "text host").
- Traverse **open shadow roots**, plus **closed** ones via `chrome.dom.openOrClosedShadowRoot` (passed into core as an injected function, so core stays chrome-free).
- `<input>` and `<textarea>` values and placeholders are handled as separate candidates.
- Visibility check: `el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })`.
- Skip `script/style/noscript/template`, our own host, and zero-size nodes. **No sampling.** Coverage is reported ("2,341 text nodes · 184 ms").

### 3.2 Measurements (all on the real element, using fractional rects with a 0.5px tolerance)

| Check                   | Method                                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self overflow           | `scrollWidth/Height > clientWidth/Height` **only when** the element clips (`overflow ≠ visible`, `text-overflow`, `line-clamp`)                                                                                         |
| Ellipsis active         | `text-overflow: ellipsis` and horizontal overflow                                                                                                                                                                       |
| Line-clamp active       | `-webkit-line-clamp` set and `scrollHeight > clientHeight`                                                                                                                                                              |
| **Clipped by ancestor** | `Range.getBoundingClientRect()` of the text compared with the clip rect of the nearest clipping ancestor (`overflow ≠ visible`, `contain: paint`, `clip-path`). Catches text that grows but is hidden by a card or row. |
| Visible spill           | Text rect exceeds its container's box (overlaps neighbors)                                                                                                                                                              |
| Page overflow           | `documentElement.scrollWidth > clientWidth`, then find the culprits whose right edge exceeds the viewport                                                                                                               |
| Input overflow          | `input.scrollWidth > clientWidth`. Placeholder width via canvas `measureText` with the input's computed font, compared with the content box.                                                                            |

Batching: **write all → read all → (restore all)** in one synchronous pass, so there's one layout and no paint in between. Yield with `scheduler.yield()` between chunks to keep every task under 50 ms. Results stream to the panel as they're found.

### 3.3 Issue taxonomy

Display names are plain descriptions of what goes wrong (changed 2026-11-05 after a first-time-user review; the engine's kinds keep their original ids). Each has a one-line definition in the panel.

| Kind (id)                 | Shown as                 | Meaning                                                                          | Severity                                        |
| ------------------------- | ------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| `hidden`                  | **Cut off**              | The box clips its text with no ellipsis; readers lose part of it without knowing | Critical                                        |
| `page-scroll`             | **Wider than window**    | The element is wider than the window, so the page scrolls sideways               | Critical                                        |
| `truncated`               | **Truncated**            | Ellipsis or line-clamp hides the end (often intentional)                         | Warning. User can mark "accepted on this site". |
| `spilling`                | **Overflows**            | Text runs out of its box and can overlap what's next to it                       | Warning                                         |
| `input`                   | **Field cut off**        | A placeholder or read-only value is longer than its field                        | Notice                                          |
| _At risk_ (stress result) | **New with longer text** | Fine now, broken under the current stress strategy                               | Inherits type                                   |

Status is always shown as **icon + color + text label**, never color alone.

### 3.4 Diagnosis: honest "likely cause"

- Walk from the text host up to the clipping ancestor and collect constraints with evidence: `white-space: nowrap/pre` (and where it's set), `max-width`/`max-height ≠ none`, `overflow` on the clipper, flex item `min-width: auto`, unbreakable long words.
- **Fixed-size detection is based on behavior, not computed values.** Computed `width` is always pixels, which is why v0.1 flagged "fixed width" everywhere. Under stress, if the box didn't grow on an axis where content did, that axis is constrained. Evidence: "Width stayed 120 px while text grew 2.3×."
- Shown with a confidence level (high / medium) and the evidence list. If we don't know, we say so.

### 3.5 Verified fixes

For each cause, candidate fixes are applied **temporarily** via the clipping/constraining element's `style` attribute. The original attribute string is saved and restored exactly. The element is re-measured and the result reported:

| Cause                           | Candidate fixes tried                                            |
| ------------------------------- | ---------------------------------------------------------------- |
| `nowrap`                        | `white-space: normal` · `overflow-wrap: anywhere`                |
| Max/fixed width                 | `max-width: none` · `width: auto`                                |
| Flex child won't shrink or grow | `min-width: 0` · `flex: 1 1 auto`                                |
| Fixed height + clip             | `height: auto` · `min-height` instead of `height`                |
| Long unbreakable token          | `overflow-wrap: anywhere`                                        |
| Intentional truncation          | Suggest `title` or a tooltip for accessibility (no layout trial) |

Output: "✔ `white-space: normal` on `.toolbar .btn` resolves it (element grows 18 px taller)". Copyable CSS.

### 3.6 Grouping, selectors, ignore rules

- **Fingerprint** = tag + normalized classes (CSS-module and hash tokens stripped) + role + parent fingerprint + issue type. Forty identical list items become one issue with 40 instances.
- **Selector** via `@medv/finder`, seeded to prefer `data-testid`, `id`, `aria-label`, and `role` and to avoid hashed classes. Plus a human label (`nav › li › a.nav-link`).
- **Ignore rules** per origin (selector + type), stored locally and manageable in Settings.

### 3.7 Performance budgets (enforced by a CI perf test on a synthetic 10k-node page)

- Scan of 5,000 text nodes: **≤ 300 ms** total. No task over 50 ms.
- Stress apply + measure + report on 5,000 nodes: **≤ 500 ms**.
- Injected runtime bundle: **≤ 35 KB gzip**. Side panel initial JS: **≤ 200 KB gzip** (size-limit).

---

## 4. Stress engine

### 4.1 Strategies

| Strategy                         | What it does                                                                                                                                                 | Catches                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Translation length** (default) | Grows each string by the expected expansion for its length (table below), using pseudo-words that keep the original as a prefix so strings stay recognizable | Realistic localization breakage                                   |
| **Pseudo-locale**                | Accents and brackets: `[Šåṽé çĥåñĝéš ·····]`                                                                                                                 | Truncation is visible at a glance: a missing `]` means it was cut |
| **Long words**                   | Injects unbreakable tokens (German compounds, URLs, emails)                                                                                                  | Missing `overflow-wrap`                                           |
| **Language samples**             | Real sample text in German, Finnish, Russian, Arabic (RTL), Japanese, Thai                                                                                   | Script-specific line breaking, taller glyphs, vertical clipping   |

**Expansion table** (planning defaults from the W3C "Text size in translation" article, which draws on IBM's 1994 guide; the source is documented in code):

| English length | Expansion: Realistic → Worst case |
| -------------- | --------------------------------- |
| ≤ 10 chars     | +100% → +200%                     |
| 11–20          | +80% → +100%                      |
| 21–30          | +60% → +80%                       |
| 31–50          | +40% → +60%                       |
| 51–70          | +31% → +40%¹                      |
| > 70           | +30%                              |

¹ The W3C copy prints 151–170% for this row, out of line with the rows around it in a table that otherwise falls as text gets longer; we use 131–140%, the value usually cited from IBM (see `src/core/stress/expansion.ts`).

A **string** is the text of one block: `You have <b>3</b> unread messages` is one 26-character string, not four nodes. Growth is sized by the whole string and split across its pieces; pieces without letters (numbers, prices) are never rewritten. Code, `translate="no"`, editable regions and ligature icon fonts are never stressed ([ADR 0007](adr/0007-stress-text-and-revert.md)).

Intensities: **Realistic** (low end of the range; the panel's default, because it finds what a translation will actually hit and so what's worth fixing) · **Worst case** (high end; the engine API's default) · **Extreme** (2× worst case). An **RTL** toggle sets `dir="rtl"` on `<html>` and is reverted exactly.

All generation uses a **seeded RNG**, so a scan is reproducible and tests are deterministic.

### 4.2 Ledger (lossless write/revert)

- The ledger records `(node, kind, originalValue)` for `Text.nodeValue`, `input.value`, `placeholder`, and the `<html dir>` attribute. Nothing else is ever touched.
- **The page's own changes win.** Revert restores a value only if it still holds what we wrote; if the app changed it since, the app's value stays (reverting would show stale text) and the next apply treats it as the new original ([ADR 0007](adr/0007-stress-text-and-revert.md)).
- A MutationObserver watches stressed nodes. If the app re-renders over our text, the panel shows "Page re-rendered 12 strings · Re-apply".
- Auto-revert on panel close (`sidePanel.onClosed` and port disconnect), navigation, and tab switch.

### 4.3 Breaking-point search (Inspect)

Binary search on string length (in place, about 8 iterations, invisible because write and read happen in the same task). It finds the maximum characters that fit and compares that with the expansion table: "Fits up to 18 chars. 'Save changes' (12) needs ~22–24 in German → **will break**."

---

## 5. UI / UX specification

### 5.1 Principles

1. **Calm instrument, not a toy.** Precise, quiet, information-dense like Chrome DevTools, Linear, or Raycast. No emoji icons, no gradients-as-branding, no bouncing arrows.
2. **Instant.** Results stream in. Hover feedback on the page is immediate. No spinners over 300 ms without progress.
3. **Honest.** Show coverage, confidence, and what was skipped. Never "All Good!" without saying what was checked.
4. **Safe.** Every page modification is visible ("Stress active · Revert") and reversible in one action.
5. **Keyboard-first, accessible by default.** WCAG 2.2 AA.
6. **Dogfood.** The side panel must pass its own pseudo-locale scan at 320 px width.

### 5.2 Surfaces

| Surface                        | Role                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| **Side panel**                 | The whole app. Doesn't cover the page (the current 400 px overlay does).            |
| **Page overlay** (shadow root) | Highlights, the picker, and a small "Stress active · Revert" pill                   |
| **Toolbar action**             | Opens the panel. Badge shows the issue count for the tab.                           |
| **Context menu**               | "Measure this element with Overflow Scout": opens the panel with the picker active¹ |
| **No popup**                   | It was a two-button launcher, so it's removed                                       |

¹ The right-clicked element can't be known without a content script on every page, which §2.2 rules out, so the picker opens and one click selects it.

### 5.3 Screens

1. **Home (first run / no results):** page host and permission state. Three actions: **Scan page**, **Test with longer text** (the stress test), **Measure an element** (Inspect); the display names changed 2026-11-05 after a first-time-user review. "Try the demo page" link and a shortcut hint. No modal tours.
2. **Scanning:** thin progress bar, live counter in tabular numbers, Cancel.
3. **Results:**
   - Summary chips that double as filters (Hidden 12 · Truncated 5 · Spilling 3 · Page scroll 1).
   - Tabs: **Broken now / With longer text**.
   - Search (`/`), sort (severity / page order), virtualized grouped list.
   - Footer: "2,341 text nodes · 184 ms · 1440×900 · 3 cross-origin frames skipped".
4. **Issue detail:**
   - Type and selector (copy).
   - **Measure bar**: "needs 214 px · has 120 px · −94 px".
   - Text before → after.
   - Instance pager (1/12).
   - Cause with evidence, and verified fixes with **Try** buttons.
   - Actions: Jump, Screenshot, Copy report, Ignore.
   - At ≥ 520 px panel width, list and detail sit side by side.
5. **Stress controls:** strategy, intensity, RTL, scope (page / picked region), **Apply & scan**. A persistent revert bar while stress is active.
6. **Inspect:** picker on the page with a DevTools-style hover box showing dimensions. The selected element card has a live fit meter, a length slider (re-measured each animation frame while dragging), the breaking point, preset chips (names, products, URLs, emails, long text), and a custom text field.
7. **Settings:** theme (System / Light / Dark), default strategy and intensity, include inputs, ignore rules, per-site permissions, keyboard shortcut (links to `chrome://extensions/shortcuts`), About.
8. **Shortcuts sheet (`?`)**.

### 5.4 States and errors (each has a message and an action)

| Situation                                            | Message → action                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Restricted page (`chrome://`, Web Store, PDF viewer) | "Chrome doesn't allow extensions on this page." → Open demo page                 |
| Page navigated                                       | "Results are from the previous page." → Re-scan (or "Always allow on this site") |
| App re-rendered stressed text                        | "12 strings were reset by the page." → Re-apply                                  |
| Nothing found                                        | "No overflow in 2,341 text nodes at 1440×900." → Run stress test                 |
| Injection failed                                     | Plain-language reason → Retry / Report issue                                     |

### 5.5 Visual system (starting tokens; contrast validated in Phase 4)

- **Type:** `system-ui` stack. 13/18 base, 12/16 secondary, 15/20 titles (600). `ui-monospace` for selectors, CSS, and measurements. `tabular-nums` for all numbers.
- **Spacing:** 4 px grid. Panel padding 12. Row height 36 (compact) / 44 (comfortable).
- **Radius:** 6 for controls, 10 for cards. Use borders rather than shadows; shadows only on popovers.
- **Color roles** (light / dark): `bg #FFFFFF / #0E0F11` · `surface #F7F7F8 / #16171A` · `border #E4E4E7 / #2A2B30` · `text #18181B / #EDEDEF` · `muted #5F5F69 / #A1A1AA` · one **accent** (ink-blue) for primary actions and focus. Severity: critical red, warning amber, notice violet, ok green. Each has a light and a dark variant meeting 4.5:1 on its surface.
- **Icons:** Lucide, 16 px, 1.5 stroke. Icon-only buttons always have an `aria-label` and a tooltip.
- **Motion:** 120 ms for hover and press, 180 ms for enter, 240 ms for view transitions. `cubic-bezier(0.2, 0, 0, 1)`, opacity and transform only. List stagger capped at 20 ms per item. `prefers-reduced-motion` turns motion off.
- **Theme:** follows `prefers-color-scheme` by default, with an override in Settings. No separate per-surface toggles.
- **Page overlay:** 2 px severity outline plus a 1 px contrasting halo, so it's readable on any background. Mono label chip (`−94px`). Subtle by default; hovered or selected items get the strong style.

### 5.6 Micro-interactions that make it feel great

- Hovering a result highlights the element on the page instantly. Clicking scrolls it into view with one short pulse.
- Copy buttons change to "Copied" for 1.2 s. No toast for local actions; toasts only for async outcomes.
- The breaking-point slider shows exactly where text starts to break as you drag.
- Results animate in as they're found, and summary numbers count up.
- The toolbar badge shows the issue count for the current tab.

### 5.7 Accessibility (WCAG 2.2 AA)

Full keyboard support (`j/k`, `Enter`, `Esc`, `/`, `?`) · visible `:focus-visible` rings · roles and labels on all controls · `aria-live` announcements for scan results · targets ≥ 24 px · contrast ≥ 4.5:1 · no color-only meaning · axe checks in CI · manual VoiceOver pass before release.

### 5.8 i18n of the extension itself

All UI strings go through WXT i18n from day one (English at launch). Layouts are RTL-safe (logical CSS properties). A tool for localization testing has to be localizable itself.

---

## 6. Engineering standards

### 6.1 TypeScript

`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. `any` is a lint **error**. No non-null `!` in `core`.

### 6.2 Code design

- `core` is pure functions. Side effects stay at the edges. `document`, the clock, the RNG, and the shadow-root opener are injected, so everything is testable.
- One feature per folder (state, components, hooks, tests together). No shared "utils" dumping ground.
- Errors are typed (`ScanError` with a `code`). Results cross message boundaries as `Result` objects. No empty `catch` (lint). Every user-facing error has a recovery action.
- Logging: a small leveled logger, stripped from production builds except errors. Nothing is printed to the console of user pages.
- Public `core` APIs have TSDoc. `ARCHITECTURE.md` includes the diagram. Decisions are recorded as ADRs.

### 6.3 Security

- `eslint-plugin-no-unsanitized`: no `innerHTML`, `outerHTML`, or `insertAdjacentHTML` with dynamic values. `dangerouslySetInnerHTML` is banned.
- Every message is validated with zod. `sender.id === chrome.runtime.id` is checked. No `window.postMessage` channels.
- MV3 default CSP. No remote code, no `eval`.
- `/security-review` before every release. `pnpm audit` in CI. Dependabot for dependencies and pinned GitHub Actions.

### 6.4 Privacy

No data collection, no analytics, no network requests (enforced by an e2e test asserting zero network requests from extension contexts). `PRIVACY.md` and a public privacy policy page. The Chrome Web Store "Privacy practices" form declares no data use.

### 6.5 Definition of Done (every PR)

Types and lint clean · tests added or updated · a11y checked for UI changes · no new budget violations · docs/ADR updated if architecture changed · Conventional Commit title.

---

## 7. Testing strategy and quality gates

| Layer             | Tool                                                                       | What                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit              | Vitest                                                                     | Text generation, expansion math, fingerprints, selectors, schemas, reducers                                                                                                          |
| **Engine corpus** | Vitest Browser Mode (real Chromium)                                        | Fixture pages with 60+ cases, each element annotated with its expected result (`data-expect`: hidden, truncated, spilling, page-scroll or ok). CI computes **precision and recall**. |
| Invariants        | Vitest browser                                                             | **Lossless revert** on every fixture (DOM snapshot before = after) · no page attribute pollution                                                                                     |
| Framework safety  | Vitest browser + small React 19 / Vue 3 / Svelte 5 fixture apps            | Stress → app re-render → revert, with no exceptions and correct final DOM                                                                                                            |
| E2E               | Playwright with the built extension (persistent context, bundled Chromium) | Demo page: scan → hover highlight → detail → try fix → stress → revert → export. Restricted page. Navigation staleness.                                                              |
| A11y              | `@axe-core/playwright`                                                     | Side panel in light and dark: 0 serious or critical issues                                                                                                                           |
| Visual            | Playwright screenshots                                                     | Side panel key screens, light and dark, at 320 / 400 / 600 px                                                                                                                        |
| Performance       | Playwright + synthetic 10k-node page                                       | Budgets from §3.7                                                                                                                                                                    |
| Privacy           | Playwright                                                                 | Zero network requests from extension contexts                                                                                                                                        |

**Fixture corpus categories (seeded from the 8 cases already tested):** fixed width on the element · width inherited from the parent · descendant selectors · flex `truncate` with `min-width:0` · grid cells · `width:100%` · max-width tabs · fixed-height badges · line-clamp · ancestor clipping (card, table cell) · visible spill · horizontal page overflow · inputs and placeholders · icon + text buttons · open and closed shadow DOM · same-origin iframe · RTL page · CJK and Thai · `content-visibility:auto` · sticky/fixed · transforms/scale · zoom 90%/125% · **strict-CSP page** · plus a **known-good** set (wrapping paragraphs, auto-width buttons) that must produce **zero** findings.

**Gates (CI must pass to merge):** precision ≥ 95% · recall ≥ 95% · 0 false positives on known-good · revert invariant 100% · axe clean · budgets met · e2e green.

---

## 8. Tooling, CI/CD, git

- **Git identity:** repo-local `user.email = basel.issmail@gmail.com` (✅ configured). Pushes use the SSH alias `github-basel`. GitHub CLI operations use the personal account via `GH_TOKEN=$(gh auth token --user baselissmail)`, so the global work login is untouched.
- **Workflow:** `main` is protected (required CI, linear history). Short-lived branches `feat/…`, `fix/…`, `chore/…`. Squash-merge PRs. **Conventional Commits** enforced by commitlint (lefthook `commit-msg`). lefthook lints and format-checks staged files on pre-commit and runs type-check and unit tests on pre-push.
- **CI (GitHub Actions):** install (pnpm, cached) → typecheck → lint → unit → browser corpus (with a precision/recall report in the job summary) → build → e2e → size-limit → upload zip artifact.
- **Release:** release-please maintains `CHANGELOG.md` and the version. Merging a release PR tags it, and CI runs `wxt zip` + `wxt submit` (CWS API credentials in GitHub secrets) and creates a GitHub Release with the zip. Edge Add-ons is submitted from the same artifact.
- **Repo hygiene:** `README.md` (users first, then development) · `CONTRIBUTING.md` · `SECURITY.md` · `PRIVACY.md` · `LICENSE` (MIT) · issue and PR templates · `.nvmrc` (current Node LTS) · `.editorconfig`.

---

## 9. Execution phases

Each phase ends with explicit exit criteria. Phases 1 and 2 (engine) can run in parallel with phase 4 (design system) once phase 0 is done.

### Phase 0 — Reset and foundation

- [x] Tag the current state `v0.1.0-legacy`. Create branch `refactor/v1`.
- [x] Resolve the deleted `public/icons/*`: the old icons moved to WXT's `public/icon/<size>.png` until the Phase 7 redesign.
- [x] Scaffold WXT + React + TS (strictest) + Tailwind v4 with pnpm. Remove CRXJS, `vite.config.ts`, and `manifest.json` (WXT generates it).
- [x] Delete dead code and phase docs (§12). Port the keepers into `core/text/presets` (now fictional names, generic products, reserved `.example` domains).
- [x] ESLint (typescript-eslint `strictTypeChecked`, `no-unsanitized`, `boundaries`, `jsx-a11y` via `@eslint/compat`), Prettier, lefthook, commitlint. Each rule verified to fire on a deliberate violation.
- [x] Vitest (unit + browser mode) and Playwright scaffolds. CI workflow with SHA-pinned actions, size budgets, Dependabot.
- [ ] Branch protection on `main` (after the first push).
- [x] ADRs: 0001 WXT · 0002 activeTab + on-demand injection · 0003 in-place measurement · 0004 side panel UI stack · 0005 no telemetry · 0006 toolchain versions.

**Exit:** `pnpm build` loads in Chrome with an empty side panel; CI green on PR. _Local run green 2026-11-04 (typecheck, lint, format, 11 unit, 2 engine, 2 e2e, size: side panel 68 kB gzip); CI pending first push._

### Phase 1 — Detection engine and corpus

- [x] Spike first: verify that `Range` rects and ancestor clip rects agree with what's visually clipped across the corpus categories. (The corpus is the spike: its first run found one real flaw, spill detection stopping at clipping boxes, which was fixed.)
- [x] `collect`, `measure`, `diagnose` (cause only), `group`, `select` (`src/core`).
- [x] Corpus of 37 fixture pages (59 expected findings, 41 explicit "ok" cases, 10 known-good pages, 2 documented limitations), precision/recall harness, performance harness, API tests.
- [x] Early reality check on 9 live sites (pulled forward from Phase 6). Six patterns caused false positives and became fixtures plus fixes: `clip`/`clip-path` visually-hidden text, off-screen skip links, negative-margin full-bleed blocks, floats hanging below their parent, vertical writing modes, and overflow into a scroll container's scrollable area (plus rowspan cells vs. table rows). After the fixes, 6 sites report nothing and the other 3 report only real truncation or their own overflow demos.

**Exit:** gates from §7 met for scan mode; budgets met. _Met 2026-11-04: precision 96.7% (the 2 misses are documented limitations: peek carousels and "Read more" previews), recall 100%, zero findings on known-good pages; 5,000 text nodes in ~68 ms of work with an 8 ms longest slice (budgets: 300 ms, 50 ms); real pages scan in 16–90 ms._

### Phase 2 — Stress engine

- [x] Strategies, expansion table, seeded RNG, ledger, RTL, at-risk diff, breaking-point search (`src/core/stress`). At-risk findings carry behavioral evidence (§3.4): "Width stayed 64px while the text grew 3×."
- [x] React, Vue, and Svelte fixture apps; lossless-revert suite.

**Exit:** revert invariant 100%; framework suites green; stress budget met. _Met 2026-11-05: every corpus page (38) is stressed, scanned and reverted with 5 strategy/intensity/RTL variants, and the DOM is identical afterwards every time. React 19, Vue 3 and Svelte 5 apps re-render while stressed (text updates, keyed moves, insertions, attribute changes) without errors, and after revert they match an unstressed copy exactly. The stress fixture matches all 8 annotated at-risk findings and its 6 "ok" cases exactly. Breaking-point search is exact to the character in ≤ 10 layouts. A stress test of 5,000 text nodes takes ~330 ms of work (budget 500 ms); planning and the single write commit stay under 10 ms per slice; revert takes ~3 ms. The one longer slice (~28 ms) is the browser laying out all the changed text at once, the same work it does to paint the stressed page. The whole engine (scan + stress) is 18.5 kB gzip (injected-runtime budget: 35 kB). Also fixed: frames skipped by the scanner weren't being counted._

### Phase 3 — Extension shell

- [x] **Spikes first:** (S1) is `activeTab` granted when the action opens the side panel via `openPanelOnActionClick`? If not, use `action.onClicked` → `sidePanel.open({ tabId })`. (S2) Behavior after in-tab navigation, plus the "Always allow on this site" flow. _Outcomes in §13 and [ADR 0002](adr/0002-active-tab-on-demand-injection.md)._
- [x] Permission model, on-demand injection, typed port protocol, sender validation, session lifecycle, auto-revert, overlay, picker, restricted-page detection, `chrome.commands`, context menu, toolbar badge ([ADR 0008](adr/0008-panel-page-protocol.md)).

**Exit:** Playwright e2e on the demo page covering scan → highlight → stress → revert, plus the restricted-page and navigation cases. _Met 2026-11-05: 13 e2e tests cover scan, highlight and reveal on the bundled demo page; stress and exact revert from the panel and from the on-page button; the picker with breaking point; injection into a normal page and auto-revert when the panel closes; re-rendered strings and re-apply; stale results after navigation and re-scan; restricted pages; sites without access; per-site access; a strict-CSP page; zero network requests from the panel; and the production manifest. Bundles: page runtime 28 kB gzip (budget 35), side panel 73 kB (200), service worker 1.1 kB (20). Not automatable in Playwright (no toolbar or context-menu clicks): the toolbar button, ⌥⇧O and the context menu are checked by hand before release (Phase 6)._

### Phase 4 — Design system and side panel UI

- [x] Install the chosen Claude Code skills (§11). Write `docs/design/DIRECTION.md` (references: DevTools, Linear, Raycast; tokens from §5.5). _Each skill was read in full and pinned to a commit (`.claude/skills/README.md`). `web-design-guidelines` downloads its rules from a branch on every run, so a pinned copy of the rules sits behind a local skill instead; `vercel-react-best-practices` is mostly Next.js and its repository has no license, so its applicable rules are summarized in DIRECTION.md._
- [x] Tokens, primitives (Button, IconButton, Chip, Tabs, Tooltip, Popover, Toast, Segmented, Kbd, EmptyState, MeasureBar, plus Switch, SelectField, Dialog, ProgressBar), and patterns (ResultRow, IssueDetail, StressBar). _Slider moves to Phase 5, where the length slider uses it._
- [x] All screens from §5.3, all states from §5.4, theme, motion, i18n plumbing. _Not yet: streaming results while a scan runs (the live count updates; results arrive at the end), and the Phase 5 parts of Issue detail and Inspect (verified fixes, screenshot, copy report, ignore, length slider, presets)._

**Exit:** axe clean · keyboard-only walkthrough passes · visual snapshots approved · **side panel passes its own scan** at 320 px with pseudo-locale. _Met 2026-11-05: axe reports no serious or critical issues on Home, results, detail, stress results, Settings and the shortcuts sheet, in light and dark; a keyboard-only e2e walkthrough covers Tab, j/k, Enter, Esc, / and ?; token contrast is unit-tested (40 pairs, both themes); the panel stresses itself with pseudo-locale text at 320 px in six states and nothing clips or spills (truncation is allowed only where a `title` carries the full text). That test found and fixed three real layout bugs before review. Screen captures at 320, 400 and 600 px in both themes are uploaded by CI for review; pixel-diff baselines need a fixed Linux font setup and come with Phase 6. Side panel JS: 133 kB gzip (budget 200)._

### Phase 5 — Inspect, fixes, reporting

- [x] Inspect flow, presets, live fit meter, breaking point. _Shown as "Measure an element". "Try other text" has a length slider, real-world text (names, products, links, emails, long text) and the user's own text; the page shows it live and the card says whether it fits or what breaks. A DevTools-style hover box while picking is not in yet._
- [x] Verified-fix trials (§3.5) with exact style restore. _Each fix is tried invisibly when a result opens and says whether it fixes the problem, helps, or does nothing, and how the box changes size. When wrapping only moves the overflow downwards, the trials add the height fix and try the fixes together. "Preview on page" keeps a fix applied until it's stopped. See ADR 0009._
- [x] Screenshot cropped to the element (captureVisibleTab + canvas crop, accounting for devicePixelRatio). Copy as Markdown. JSON export. Ignore rules. _Screenshots need `activeTab` (a toolbar click); without it the panel says so (ADR 0009). Ignore rules match the issue's fingerprint per site, not a selector, so they hold across scans; Settings lists them._

**Exit:** e2e for each; Markdown renders correctly when pasted into GitHub and Jira. _Met for GitHub on 2026-11-05: the copied report rendered through GitHub's Markdown API with its heading, nested lists and code spans intact, and escaped page text stayed literal. Jira Cloud converts pasted Markdown with the same syntax; checking it in a real Jira project is part of the manual pre-release check. e2e covers verified fixes and preview, Copy report and JSON export, the screenshot refusal, ignore rules, and the Measure flow; cropping is tested in a real browser._

Example report (Copy as Markdown):

```md
### Hidden text: `button.save-btn` (12 instances)

- Page: https://app.example.com/settings · 1440×900 · Chrome 156
- Text: "Save changes" → stress (worst case): "Save changes Ŝàvé çĥàñ…" (+100%)
- Needs 214px, has 120px (−94px)
- Likely cause (high): `white-space: nowrap` + `max-width: 120px` on `.toolbar .btn`
- Verified fix: `white-space: normal` → resolves (button grows 18px taller)
  ![screenshot](overflow-save-btn.png)
```

### Phase 6 — Hardening and dogfooding

- [ ] Dogfood on 20 real sites and design systems (e.g. GitHub, Gmail, Wikipedia, Amazon, Booking, Stripe docs, MUI, Bootstrap, Tailwind docs, Shopify admin demo). Log false positives and negatives, and turn each one into a fixture.
- [ ] Edge cases: closed shadow roots, same-origin iframes, SPA navigation, strict CSP (constructable stylesheets in the shadow root), zoom/DPR, RTL pages, very large pages, memory (observers disconnected, WeakMaps).
- [ ] `/code-review` and `/security-review` passes. Fix everything P0/P1.

**Exit:** dogfood false-positive rate < 5%; no open P0/P1.

### Phase 7 — Brand, listing, publish

- [ ] Name check on the Chrome Web Store. Icon design: a text line cut by a measuring edge, 16/32/48/128 px, plus a 128 px store icon with 96 px artwork and 16 px padding (per Chrome's image guidelines; verify at submission).
- [ ] Listing assets (§10). Landing page on GitHub Pages with demo GIF, docs, privacy policy, changelog.
- [ ] Rewrite the README. Final ADR review. `v1.0.0` release via release-please. Submit to the Chrome Web Store, then Edge.

**Exit:** published and live; support channels working.

### Phase 8 — After launch

- v1.1: **Real translation preview** using Chrome's on-device Translator API (stable since Chrome 138, desktop only). Needs a spike to confirm availability in extension pages and the language-pack download UX. Also viewport sweep and a Firefox build (WXT; Firefox uses a sidebar instead of `sidePanel`; verify).
- v1.2: publish `core` as **`@overflow-scout/core`** with a Playwright matcher (`await expect(page).toHaveNoTextOverflow()`) so teams can catch regressions in CI.
- Ongoing: localize the UI (de, ar, ja), nominate for the Featured badge, fixture-driven fixes from user reports.

---

## 10. Chrome Web Store publishing checklist

#### Account

- [ ] Chrome Web Store developer account on the personal Google account (one-time registration fee; 2-Step Verification required). Verified publisher email. Website URL and support URL set.

#### Listing copy

- [ ] Title: "Overflow Scout": clear, unique, no keyword stuffing.
- [ ] Summary (≤ 132 chars, plain text). Draft: _"Find clipped and truncated text before users do. Stress-test with translation-length text and get verified CSS fixes."_
- [ ] Description: overview paragraph and a short feature list. Accurate keywords only (overflow, truncation, pseudo-localization, i18n, QA). No superlatives, no competitor references.
- [ ] Category: Developer Tools. Language: English.

#### Visual assets

- [ ] 5 screenshots at **1280×800**, full-bleed, square corners, current UI, light text overlays: (1) Scan results on the demo page, (2) Issue detail with a verified fix, (3) Stress test with "With longer text", (4) Inspect breaking point, (5) Dark mode and Markdown report.
- [ ] Small promo tile **440×280**. Marquee **1400×560** (saturated, little text, readable at half size).
- [ ] 30–60 s demo video (YouTube).
- [ ] No claims like "Editor's Choice" or "#1" in images.

#### Privacy and compliance

- [ ] Single-purpose statement (§1.2).
- [ ] Permission justifications:
  - `activeTab`: scan only the tab you click the button on.
  - `scripting`: inject the scanner on demand.
  - `sidePanel`: show results beside the page.
  - `storage`: save settings and ignore rules locally.
  - `contextMenus`: right-click to inspect an element.
  - Optional host permissions: only when you choose "Always allow on this site".
- [ ] Data usage: none collected. Certify Limited Use. Remote code: **No**.
- [ ] Privacy policy URL (GitHub Pages).

#### Before submitting

- [ ] Production build: no console noise, no source maps in the zip (or uploaded separately), version bumped, `minimum_chrome_version` set.
- [ ] Fresh-profile manual test: install → first run → demo → real site → uninstall.
- [ ] `chrome.runtime.setUninstallURL` pointing to an optional short feedback form (no tracking).

#### Launch

- [ ] Show HN, r/webdev, r/Frontend, dev.to article ("Your UI will break in German, and here's how to see it today"), LinkedIn, Product Hunt.
- [ ] GitHub Discussions for feedback. "Report false positive" in the panel opens a prefilled GitHub issue (user reviews the content first; page text excluded by default).

---

## 11. Claude Code skills for the UI work

Install at project scope **after reviewing each SKILL.md** (they are third-party instructions):

| Skill                         | Source                            | Use                                                                                                                |
| ----------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `frontend-design`             | `anthropics/skills` (official)    | Makes deliberate aesthetic choices instead of generic AI styling. Constrained by §5 so it stays a calm instrument. |
| `web-design-guidelines`       | `vercel-labs/agent-skills`        | Pre-ship audit of UI code against 100+ accessibility and UX rules                                                  |
| `vercel-react-best-practices` | `vercel-labs/agent-skills`        | React performance rules (we use React 19)                                                                          |
| `chrome-extension-ui`         | `pproenca/dot-skills` (community) | 42 MV3-specific UI rules (side panel, badge, popup, options)                                                       |

Install command form: `npx skills add https://github.com/<repo> --skill <name>`.
**Skip:** UI UX Pro Max and Taste Skill. They're competing style engines (guides warn against combining them), and our tokens already define the style. Built-in `/code-review` and `/security-review` are used at phase gates.

---

## 12. What we keep vs. delete from v0.1

#### Keep (port and improve)

- Preset text pools (`src/lib/autoBadge.ts:97-208`) → `core/text/presets.ts`
- The idea behind `setTextPreservingChildren` (`src/content/index.ts:794`) → generalized into the `nodeValue` ledger
- Screenshot via `captureVisibleTab` (`src/background/index.ts`) → add an element crop
- Picker UX (hover outline, Esc to exit) → rebuilt in the shadow-root overlay
- MIT license, project name, repo history

#### Delete

- All of `src/` once ported (CRXJS entrypoints, the 2,635-line `autoBadge.ts` panel, `cloneMeasurement.ts`, and the unused or unreachable modules: `badgeIndicator`, `ghostOverlay`, `manualCard`, `smartTextGenerator`, `batchProcessor`, `elementGrouper`, `highlighter`, `sessionBanner`, `stateManager`, `textPatterns`, `performanceMonitor`, `errorHandler`, `spaObserver`, `shadowDomHelper`, `keyboardShortcuts`)
- The popup (`src/popup/*`)
- `manifest.json`, `vite.config.ts` (WXT replaces them)
- Phase docs: `ANALYSIS.md`, `AUTO_SCAN_FEATURE.md`, `DEVELOPMENT.md`, `INTEGRATION_GUIDE.md`, `INTERACTIVE_MODE.md`, `MIGRATION-TO-CRXJS.md`, `PHASE9_FINAL_SUMMARY.md`, `UX_IMPROVEMENTS_SUMMARY.md`
- LinkedIn credit inside scanned pages (it moves to Settings → About and the listing)

---

## 13. Risks and spikes

| #   | Risk / unknown                                                      | Mitigation                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `activeTab` grant when the panel opens via `openPanelOnActionClick` | **Resolved (Phase 3):** not documented as a grant, so the panel opens from `action.onClicked` → `sidePanel.open({ tabId })`, a documented gesture                                              |
| S2  | Re-scan after in-tab navigation needs a new grant                   | **Resolved (Phase 3):** same-origin navigation keeps access; cross-origin needs a click or the per-site grant, offered once connected (Chrome hides the URL before). Stale results are marked. |
| S3  | Strict page CSP blocking our shadow-root styles                     | **Resolved (Phase 3):** constructed stylesheets; e2e test on a page with `default-src 'none'`                                                                                                  |
| S4  | Apps re-rendering over stressed text                                | MutationObserver detection + "Re-apply"                                                                                                                                                        |
| S5  | Intentional truncation flagged as noise                             | "Truncated" is a Warning, with per-site accept rules                                                                                                                                           |
| S6  | Translator API in extension contexts (v1.1)                         | Spike before committing to it; pseudo-locale remains the default                                                                                                                               |
| S7  | Firefox side panel parity (v1.1)                                    | WXT sidebar mapping; verify before promising                                                                                                                                                   |
| S8  | Ancestor-clip geometry with transforms, zoom, or sticky elements    | Dedicated fixtures; fall back to the self-overflow check with lower confidence                                                                                                                 |

---

## 14. Decisions

All recommended options below were accepted on 2026-11-04.

1. **UI stack:** React 19 + Tailwind v4 + shadcn/Radix _(recommended)_ · Svelte 5 · Preact
2. **Approach:** fresh WXT scaffold on a branch, porting the keepers _(recommended; about 75% of the code is replaced anyway)_ · incremental refactor
3. **Business model:** free and open source for v1 _(recommended)_ · freemium later (CI package, team reports)
4. **Analytics:** none _(recommended; "nothing leaves your browser" is a feature)_ · opt-in anonymous counts
5. **Launch browsers:** Chrome + Edge _(recommended)_, Firefox in v1.1
6. **Name:** keep "Overflow Scout" _(recommended, after a store name check)_
7. **Credit:** Settings → About and the store listing _(recommended)_ · also in the panel footer

---

## Sources

- [WXT framework comparison](https://wxt.dev/guide/resources/compare)
- [Chrome `sidePanel` API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Chrome Web Store, creating a great listing](https://developer.chrome.com/docs/webstore/best-listing)
- [Chrome Web Store discovery and badges](https://developer.chrome.com/docs/webstore/discovery)
- [Playwright, Chrome extensions](https://playwright.dev/docs/chrome-extensions)
- [W3C, Text size in translation](https://www.w3.org/International/articles/article-text-size)
- [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [Claude Code skills roundup (install commands)](https://www.firecrawl.dev/blog/best-claude-code-skills)
- [Chrome extension UI skill (community)](https://skills.sh/pproenca/dot-skills/chrome-extension-ui)
- [PseudoLocalizer (existing, MV2)](https://chromewebstore.google.com/detail/cemecdhgfjmgndjdnlofnenhiekppnep)
- [Pseudolocalize (Firefox)](https://addons.mozilla.org/firefox/addon/pseudolocalize)
