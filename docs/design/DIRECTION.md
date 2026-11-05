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

## The one memorable thing: the measure bar

Everything else is quiet so the **measure bar** can carry the identity. It is a
ruler, not a progress bar:

```text
has 120 px                    needs 214 px
├───────────────┤╱╱╱╱╱╱╱╱╱╱╱╱┤
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ −94 px  (hatched, in the severity color)
```

- The solid track is the box. The hatched part past its end is the text that
  doesn't fit: a print "bleed".
- Tick marks every 10 % of the needed width, in the line color.
- Labels are in monospace with tabular figures. The deficit is in the severity
  color and also stated in words for screen readers.
- The same bar shows the room in Inspect: "fits up to 18 characters" against
  what a translation needs.

## Tokens

### Color

Semantic roles only; components never use raw colors. Light / dark:

| Role              | Light                 | Dark                  | Use                                          |
| ----------------- | --------------------- | --------------------- | -------------------------------------------- |
| `canvas`          | `#FFFFFF`             | `#0E0F11`             | Panel background                             |
| `surface`         | `#F4F4F6`             | `#18191C`             | Hovered rows, segmented tracks, notices      |
| `line`            | `#E4E4E7`             | `#2A2B30`             | Dividers and card borders                    |
| `line-strong`     | `#8B8D98`             | `#6F7079`             | Borders of form controls (3:1, WCAG 1.4.11)  |
| `fg` / `fg-muted` | `#18181B` / `#5F5F69` | `#EDEDEF` / `#A1A1AA` | Text                                         |
| `accent`          | `#3451D1`             | `#8EA2FF`             | Primary actions, focus, selection (ink blue) |
| `critical`        | `#C62A2F`             | `#FF9592`             | Hidden, page scroll                          |
| `warning`         | `#9A4A00`             | `#FFC53D`             | Truncated, spilling, the stress bar          |
| `notice`          | `#6550B9`             | `#B9A6FF`             | Inputs                                       |
| `ok`              | `#18794E`             | `#3DD68C`             | "Room for translation", fits                 |
| `scrim`           | black 32 %            | black 60 %            | Behind dialogs                               |

Each severity has a `-soft` background. Every text pair meets 4.5:1 on its
background in both themes (`src/ui/tokens.test.ts`). Status is always color +
text, never color alone.

### Type

- `system-ui` stack: 13/18 body, 12/16 secondary, 15/20 titles at 600.
- `ui-monospace` only for code: selectors, CSS, and pixel measurements. Not for
  labels or headings.
- `tabular-nums` for every number that changes or is compared.
- **Sentence case** everywhere, matching Chrome. No all-caps labels or eyebrows.

### Space, shape, motion

- 4 px grid. Panel padding 12. Rows 36 px (compact).
- Radius 6 for controls, 10 for cards. Borders, not shadows; shadows only on
  floating layers (tooltips, popovers, toasts).
- Motion: 120 ms for hover and press, 180 ms to enter, 240 ms for view changes,
  `cubic-bezier(0.2, 0, 0, 1)`, opacity and transform only. Motion answers an
  action; nothing animates on its own except the scanning bar. Off under
  `prefers-reduced-motion`.

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
- Home has three actions, each with one line saying what it does, plus the demo
  link and the shortcut. No tours or modals.
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
