# 0010. Report overflow people can see; learn route changes from the page

- Status: Accepted
- Date: 2026-11-06

## Context

Dogfooding on 23 real sites (Phase 6) gave 564 findings, most of them wrong. Nearly all came from two patterns:

- **Vertical spills out of boxes nobody can see**: an app shell exactly one window tall, a fixed-height hero row, a zero-height wrapper. Text ran past their bottom edge, but the box had no border, background or shadow, and nothing sat underneath, so the page looked normal.
- **Boxes cropped on purpose**: a product mock bleeding off a hero frame, a carousel's next slide peeking in. The text fit its own box; the box was placed past the clipping edge.

Separately, the first navigation fix (reading URL changes from `tabs.onUpdated`) failed review: Chrome omits the URL without host access, reports anchor jumps as `loading`, and can't tell a hash route from an anchor.

## Decision

**A spill counts when it can be seen.**

- Sideways, text that outgrew its own box always counts (it runs into margins, the next column, or off-screen), unless it's under 2 px: a glyph's overhang.
- Downwards, and sideways when a wider box of the text's own runs past the edge, it counts only if the edge is visible (a border, a shadow, or a background unlike what's behind it) or the text lands on an in-flow neighbour. Overlays and other positioned layers don't count as neighbours, and the search stops at a positioned ancestor, which overlaps its siblings by design.
- When an edge isn't visible, the walk goes on to outer boxes, which may still show the overflow.
- A scroll container's padding is part of what scrolls.

**A crop is not a clip.**

- If the cut lies past the page's reachable width, it's never seen.
- Walking up from the text, the first box that ends inside the clipping edge means the text outgrew it, so the clip counts. A box that crosses the edge with room to spare inside its content box (padding doesn't count) was placed there, so the text is cropped, not cut off. A label that can't shrink still counts: it has no room beyond its text.

**The page reports route changes.** The page runtime listens to the Navigation API (`currententrychange`) and sends `navigated` when a same-document navigation shows a different page:

- A new path counts.
- A new query counts when pushed, not when replaced (a search box keeping the URL in sync).
- A new hash counts only for hash routes (`#/…`, `#!/…`), not anchors.

Full loads already close the port. The panel no longer reads `tabs.onUpdated`.

Every false positive became a corpus case that fails without its rule (`known-good/layout-wrappers.html`, `clipping/placed-or-outgrown.html`), next to true positives that guard against hiding real problems (`spill/unseen-edges.html`).

## Consequences

- On the same 23 sites, findings fell from 564 to 34, with one false positive (`docs/dogfood/2026-11.md`). On the corpus with the new cases, precision went from 80.5% to 96.9%, at 100% recall both times. The carousel limitation is fixed.
- One corpus annotation changed. In a grid whose first column grows, "Open" in the second column is only pushed along, and the title that grew the column is still reported.
- Known gaps, recorded as limitations: sidebars that scroll only while hovered (telling them apart needs the page's style rules), and fading "Read more" previews.
- The page runtime grew to 32.5 kB gzip (budget 35).
