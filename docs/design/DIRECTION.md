# Design direction

How the side panel and the page overlay look and behave. It narrows the
specification in [REFACTOR_PLAN.md §5](../REFACTOR_PLAN.md#5-ui--ux-specification);
where they differ, this file is newer. Tokens live in
[`src/ui/styles.css`](../../src/ui/styles.css), and a unit test checks their contrast.

## Subject, audience, job

- **Subject:** a measuring instrument for text that doesn't fit its box. The
  vocabulary comes from print proofing: boxes, bleed, crop, rulers, proof marks.
- **Audience:** frontend engineers, QA and designers, often with DevTools open
  next to it. They read selectors and CSS fluently and want numbers, not mood.
- **Primary job:** show where text is cut off now or will be when translated,
  why, and by how much, then get the user to the element in one click.

References: Chrome DevTools (density, monospace for code), Linear (calm
hierarchy, keyboard-first), Raycast (fast list with a detail view).

## The signature: show the cut

The product shows the cut instead of describing it. One device carries the
identity, and everything else stays quiet so it can:

- **Cut text.** Wherever a problem has text, the panel shows it as readers see
  it, a **crop mark** where it is cut, and the lost part over a faint **bleed**
  hatch: `Seasonal collections a|nd limited editions`. The engine finds the
  exact split by measuring rendered character rects against the clipping box
  (`textCut` in `src/core/measure/cut.ts`). It appears in every row of the
  list and, large, in a problem's details, with one line under it: "Needs 64
  px of height, has 44 px. 20 px short."

The brand mark is the same idea: crop marks around a line that runs out of
its frame.

## Tokens

### Color

Semantic roles only; components never use raw colors. An ink-tinted ground
with paper-white raised surfaces, rather than flat white with one accent
(Impeccable: "a grey screen with one accent colour is the category default").
Light / dark:

| Role              | Light                 | Dark                  | Use                                          |
| ----------------- | --------------------- | --------------------- | -------------------------------------------- |
| `canvas`          | `#F3F4F8`             | `#0B0C10`             | The ground                                   |
| `raised`          | `#FFFFFF`             | `#14161B`             | Cards, the result list, the detail proof     |
| `surface`         | `#E9EBF2`             | `#1C1F26`             | Hovered rows, segmented tracks, code wells   |
| `line`            | `#DFE2EA`             | `#262A33`             | Dividers                                     |
| `line-strong`     | `#858A99`             | `#6E7381`             | Borders of form controls (3:1, WCAG 1.4.11)  |
| `fg` / `fg-muted` | `#14161B` / `#555A69` | `#ECEEF3` / `#A3A8B6` | Text                                         |
| `accent`          | `#3451D1`             | `#8EA2FF`             | Primary actions, focus, selection (ink blue) |
| `critical`        | `#C2272D`             | `#FF9592`             | Hidden, page scroll                          |
| `warning`         | `#934600`             | `#FFC53D`             | Truncated, spilling, the stress bar          |
| `notice`          | `#6049B3`             | `#B9A6FF`             | Inputs                                       |
| `ok`              | `#16734A`             | `#3DD68C`             | "Room for translation", fits                 |
| `scrim`           | ink 36 %              | black 60 %            | Behind dialogs                               |

Each severity has a `-soft` background. Every text pair meets 4.5:1 on canvas,
raised and its soft background, in both themes (`src/ui/tokens.test.ts`, 56
pairs). Status is always icon, color and text, never color alone: each kind
of problem has its own drawn icon (eye-off, ellipsis, an arrow leaving a line,
horizontal scroll, a text cursor).

### Type

- **Geist** for the interface and **Geist Mono** for code (OFL-1.1, bundled
  with the extension, never fetched). 14/20 body, 12/16 secondary, 16/22
  titles at 600, and 18/26 for the cut text in a problem's details: the one
  large thing in the panel.
- Mono only for code and data: selectors, CSS, and pixel measurements. Not for
  labels or headings.
- `tabular-nums` for every number that changes or is compared.
- **Sentence case** everywhere, matching Chrome. No all-caps labels or eyebrows.

### Space, shape, motion

- 4 px grid. Panel padding 16. Rows about 64 px: a kind line and up to two lines of text.
- Radius 8 for controls, 12 for cards. Raised surfaces sit on the ground with
  a hairline only; shadows only on floating layers (palette, dialogs,
  tooltips, toasts). No glass or blur.
- The parts the browser draws are themed too: text selection, the caret,
  thin scrollbars, focus rings, native control accents.

### Motion

Motion answers an action; nothing moves on its own.

- **Entering a view:** a view one step in (a problem, your own text, Settings)
  and the picking prompt fade and rise in once, 220 ms.
- **Feedback:** 150 ms press and hover (a color or surface step, never a
  scale-up); a light band runs along the progress bar while the page is
  checked.
- One curve for everything, `cubic-bezier(0.22, 1, 0.36, 1)`. Nothing loops
  except live progress. Under `prefers-reduced-motion` all of it is off and
  content is visible at once.

## Flow (2026-11-07)

The panel had grown a header with three controls, a toolbar, severity counts,
kind filters, search and sort, a footer, a Home screen and a stress options
form. A first-time user found it cumbersome, couldn't find the way back, and
read the test text as gibberish. This pass started over from what people come
to do (the `frontend-design` skill: subject first, then layout, then one bold
element):

1. **Is anything cut off on this page?** Check the page, read the list, open a
   problem, copy the fix.
2. **What breaks when the text gets longer?** Make the text longer, see what's
   new, put it back.
3. **Will this element take my text?** Pick it and type, or fill it in one
   click.

So the panel is **one main screen and three views one step in**:

```text
main screen                               one step in
+-------------------------------+         +-------------------------------+
| [] Overflow Scout          *  |         | [] Overflow Scout          *  |
| [Check page] [Try your own..] |         | <- All problems   Place 1 of 2|
| Text length                   |         | . Cut off                     |
| [ Normal | Longer | Much ... ]|         | The box hides the end of ...  |
| hint: what the length does    |         | +---------------------------+ |
| 5 problems       [Copy report]|         | | Waterproof hiking jacket  | |
| Found in 28 texts.            |         | | with detachable|insulated | |
| +---------------------------+ |         | +---------------------------+ |
| | . Cut off  New    2 places| |         | How to fix it                 |
| | Add to cart Add|to        | |         | Try your own text             |
| +---------------------------+ |         | Show on page  Copy report ... |
| example.com     Always allow  |         | > Why it happens              |
+-------------------------------+         +-------------------------------+
```

- **The controls never move.** Check page, Try your own text and Text length
  are always at the top of the main screen; the list is below. Before the
  first check, one heading and one sentence above them say what it's for, and
  a link at the bottom opens the demo page.
- **Text length is the page's state, not an action.** Normal, Longer and Much
  longer show how long the page's text is right now. Choosing Longer makes it
  longer and checks it; choosing Normal puts it back and checks again, so the
  list always describes the page as it is. The button on the page ("Back to
  normal") does the same. The hint under the control says what the page is
  showing and how to get back. Only the translation length is offered: the
  other strategies (pseudo-locale, language samples, long words, right to
  left, a picked region) stay in the engine and its tests, not in the panel.
- **New problems come first.** With longer text, the list shows every problem,
  the new ones first and marked New, under "9 problems. 5 are new with longer
  text." No tabs.
- **Every view one step in starts the same way**: a back link that says where
  it goes ("All problems", "Back"), in the same place, and Esc does the same.
  The name at the top leads back to the main screen too. There is no Home
  screen to find.
- **A problem's details are in working order**: what's wrong (the kind and one
  sentence), the text as readers see it (the signature), How to fix it (each
  fix tested on the page), Try your own text (open, not behind a button), then
  quiet actions in words, and Why it happens folded away.
- **Try your own text** is one editor wherever it appears: a field that holds
  exactly what's on the page, and one row of fills (Longer, Much longer, Long
  name, Long link, Paragraph). Pressing a fill again shows its next example.
- **Less on screen.** Gone: the kind filters, severity counts and their help,
  sort, Clear results, the footer statistics, the export menu (files are in
  the command palette), the Commands button (Cmd/Ctrl+K and Settings still
  lead there), the length slider, and the animated Home demo. Search appears
  only above 12 problems.
- **Single column at every width.** The detail replaces the list; there is no
  side-by-side mode to learn.
- The panel has to pass its own stress test: at 320 px with pseudo-locale text,
  nothing in its chrome may clip or spill. Buttons wrap their labels and rows
  grow.

## Writing

- **Plain English in plain ASCII.** No accented letters, other scripts, curly
  quotes, dashes, ellipsis characters, multiplication signs or middle dots
  anywhere the panel writes: its strings (`src/locales/ascii.test.ts`), the
  examples it fills in (`presets.test.ts`), element paths (`main > nav > a`),
  and copied reports. The longer text is the page's own words, so it stays in
  the page's language.
- Name things by what people do and see: "Check page", "Try your own text",
  "Text length", "Normal", "Longer", "Back to normal". Not tool jargon ("scan",
  "stress test", "measure", "revert", "inspect"); the code keeps `stress` and
  `inspect` as ids, and the command palette finds the old names.
- Problems are named by what goes wrong: "Cut off", "Cut short", "Spills out",
  "Wider than the window", "Too long for its field", each with one sentence in
  the details. Severity is a colored dot next to the words, and the order of
  the list; it isn't named in the panel.
- No implementation words in the UI: "texts", not "text nodes" or "strings";
  "window", not "viewport"; "problems", not "issues" or "findings".
- Every problem ends in a next step: How to fix it comes before the evidence.
  Each fix says what happened when the page tried it ("Fixes it. The box gets
  22 px taller."), with an icon and words, never color alone.
- Reports are written for the person who fixes the bug: what goes wrong, where,
  by how much, why, and what fixed it, in that order. Page text is quoted and
  escaped; CSS and selectors are code.
- Every empty or error state says what happened and what to do next.
- Numbers are numerals with the unit: "94 px", "12 places".
- No exclamation marks, no "All good!". Say what was checked.

## React rules we follow

From `vercel-react-best-practices` (not vendored, see `.claude/skills/README.md`),
the parts that apply to a locally loaded panel:

- Virtualize long result lists (TanStack Virtual); never `.map()` thousands of rows.
- Keep typing cheap: filter with `useDeferredValue`, derive instead of syncing state.
- Import icons individually; load rarely used views (Settings, shortcuts) lazily.
- No layout reads during render; measurement belongs to the page runtime.

## Review checklist

Before merging UI changes: run the `web-interface-guidelines` skill on the changed
files, the axe e2e checks (light and dark), the keyboard walkthrough test, and look
at the screen captures the visual test writes (320, 400 and 600 px, both themes).

## Implementation notes

Things that cost time once, so they don't again:

- **Chrome styles extension pages.** It applies its own stylesheet with
  `body { font-size: 75% }`, and that outranks everything inside `@layer`. Our
  `body` rule is unlayered for that reason, and the root keeps 16 px so
  Tailwind's rem spacing stays on the 4 px grid.
- **Segmented items use `flex-auto`, not `flex-1`.** A zero flex basis makes the
  group as narrow as its longest word, so short labels wrap for no reason.
- **Esc is one document listener in the app,** and it does nothing while the
  command palette or the shortcuts dialog is open: Radix closes those itself.
  Otherwise it always means "back to the main screen" (or stop picking).
- **Dialogs focus themselves on open.** Focusing the close button would show its
  tooltip, and the first Esc would only close the tooltip.
- **Tests type at a human pace.** At Playwright's default speed (keys under 30 ms
  apart) Radix tooltips can open after focus has already moved on.
