---
name: impeccable
description: Design direction and critique for the side panel and overlay, from Impeccable's reference guides (vendored, guidance only). Use when making UI bolder, more refined, typeset, animated, or delightful, or for a design critique or polish pass.
---

# Impeccable design guidance (vendored references)

These are Impeccable's reference guides, pinned and unchanged (see
`../README.md`). Only the guidance is vendored: **the Impeccable launcher,
scripts and hooks are deliberately not installed.** Wherever a reference says
to run `impeccable …` or `.agent/skills/impeccable/scripts/…`, skip that step
and do the assessment by reading the code and looking at rendered screenshots
(`pnpm build:e2e && pnpm exec playwright test tests/e2e/ui.spec.ts` writes
them to `test-results/screens/`).

Project context: the product brief is `docs/REFACTOR_PLAN.md` §1 and §5, and the
design system is `docs/design/DIRECTION.md`. The side panel is an **Operate**
surface (`reference/mode-operate.md`): scanability and native conventions come
first, and the world shows up through type, palette, density and one
signature move (the cut text and the measure bar).

Before any UI edit, read `reference/craft-floor.md`. Then use the reference
that matches the request:

| Request                     | Reference                  |
| --------------------------- | -------------------------- |
| Critique or review          | `reference/critique.md`    |
| Technical audit             | `reference/audit.md`       |
| Final pass before shipping  | `reference/polish.md`      |
| Too safe or bland           | `reference/bolder.md`      |
| Typography                  | `reference/typeset.md`     |
| Motion                      | `reference/animate.md`     |
| Personality                 | `reference/delight.md`     |
| Spacing and hierarchy       | `reference/layout.md`      |
| Color                       | `reference/colorize.md`    |
| Operate surfaces            | `reference/operate.md`     |
