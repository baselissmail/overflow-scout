# Contributing

Thanks for helping make Overflow Scout better. Please open an issue to discuss larger
changes before starting on them.

## Workflow

1. Branch from `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
2. Make focused commits using [Conventional Commits](https://www.conventionalcommits.org)
   (`feat(core): detect ancestor clipping`). A git hook checks the message.
3. Run `pnpm check` (and `pnpm build && pnpm build:e2e && pnpm test:e2e` for extension changes).
4. Open a pull request and complete the checklist in the template. Pull requests are
   squash-merged once CI is green.

## Standards

- **Architecture:** `core` stays free of extension and UI APIs; layers import only what
  their policy allows. ESLint enforces both.
- **Safety:** never render page text as HTML, never add attributes or classes to page
  elements, and keep every page change reversible.
- **Detection changes** come with a fixture in the corpus (`tests/fixtures`) that fails
  before the change and passes after it.
- **UI changes** must work with the keyboard alone, in light and dark mode, and at a
  320 px panel width.
- **Permissions:** adding one requires updating the plan and its Chrome Web Store
  justification.

Significant design decisions are recorded in [docs/adr](docs/adr).
