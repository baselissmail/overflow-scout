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

The product shows the cut instead of describing it. Two devices carry the
identity, and everything else stays quiet so they can:

- **Cut text.** Wherever a finding has text, the panel shows it as readers see
  it, a **crop mark** where it is cut, and the lost part over a faint **bleed**
  hatch: `Seasonal collections a▕nd limited editions`. The engine finds the
  exact split by measuring rendered character rects against the clipping box
  (`textCut` in `src/core/measure/cut.ts`). It appears in every result row
  and, large, in the detail's proof card.
- **The measure bar**, a ruler, not a progress bar:

  ```text
  has 120 px                    needs 214 px
  ├───────────────┤╱╱╱╱╱╱╱╱╱╱╱╱┤
  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ −94 px  (hatched, in the severity color)
  ```

  The solid track is the box; the hatched part past its end is the bleed.
  Ticks every 10 %. The deficit is in the severity color and in words for
  screen readers. Inspect uses the same bar in characters.

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
  with the extension, never fetched). 13/18 body, 12/16 secondary, 15/20
  titles at 600; the proof card's cut text is set at title size.
- Mono only for code and data: selectors, CSS, and pixel measurements. Not for
  labels or headings.
- `tabular-nums` for every number that changes or is compared.
- **Sentence case** everywhere, matching Chrome. No all-caps labels or eyebrows.

### Space, shape, motion

- 4 px grid. Panel padding 12. Rows 36 px (compact).
- Radius 6 for controls, 10 for cards. Raised surfaces sit on the ground with
  a hairline and a 1 px soft shadow; deeper shadows only on floating layers
  (palette, dialogs, tooltips, toasts). No glass or blur.
- The parts the browser draws are themed too: text selection, the caret,
  thin scrollbars, focus rings, native control accents.

### Motion

One authored moment; everything else answers an action.

- **The moment:** on Home, a button label lengthens the way a translation does
  until it outgrows its box; the crop mark lands on the edge and the measure
  bar fills in (about 1.5 s, once).
- **Continuity:** on narrow panels, list ⇄ detail is a View Transition. The
  detail's measure bar draws itself: the box first, then the bleed.
- **Arrival:** when results land, the first eight rows stagger in (20 ms apart)
  and the counts count up. Never again while filtering or scrolling.
- **Feedback:** 120 ms press and hover; a light band runs along the scanning bar.
- Arrivals ease with `cubic-bezier(0.16, 1, 0.3, 1)`. Under
  `prefers-reduced-motion` all of it is off and content is visible at once.

## Layout

```text
narrow (< 520 px)                         wide (≥ 520 px)
┌───────────────────────────────┐         ┌──────────────────┬─────────────────┐
│ Overflow Scout        ⚙  ?    │         │ list             │ detail          │
│ shop.example · Always allow   │         │                  │                 │
│ Scan page  Stress test  Insp. │         │                  │                 │
│ Hidden 12 Truncated 5 Spill 3 │         │                  │                 │
│ Broken now | With longer text │         │                  │                 │
│ / Search…              Sort   │         │                  │                 │
│ Hidden  nav › a.tab      ×12  │         │                  │                 │
│ Seasonal collections an…      │         │                  │                 │
│ …                             │         │                  │                 │
│ 2,341 text nodes · 184 ms     │         │                  │                 │
└───────────────────────────────┘         └──────────────────┴─────────────────┘
```

- Left aligned throughout. The list is the spine; the detail replaces it when
  narrow (with Back) and sits beside it when wide.
- Home leads with the demo and one primary action (Scan page); the other two
  actions are rows below, not a grid of identical cards. Then the demo link and
  the shortcut. No tours or modals.
- **⌘K / Ctrl+K** opens the command palette: every action that applies right
  now, with its shortcut, filtered as you type (Raycast's pattern).
- The panel has to pass its own stress test: at 320 px with pseudo-locale text,
  nothing in its chrome may clip or spill. Buttons wrap their labels, rows grow,
  and content that is truncated on purpose (long page text, selectors) carries
  its full text in a `title` and in the detail view.

## Writing

- Name things by what users see: "Scan page", "Stress test", "Revert".
- Every empty or error state says what happened and offers the next action.
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
- **The wide layout always has two columns.** Opening details in a column that
  appears on demand narrows the list, and its virtualized rows overlap for a
  frame until they are measured again.
- **Esc goes through React handlers on the container,** not a document listener
  added in an effect, so it works the instant a view appears. Radix layers
  (tooltips, dialogs) take Esc first, which is the expected order.
- **Dialogs focus themselves on open.** Focusing the close button would show its
  tooltip, and the first Esc would only close the tooltip.
- **Tests type at a human pace.** At Playwright's default speed (keys under 30 ms
  apart) Radix tooltips can open after focus has already moved on.
