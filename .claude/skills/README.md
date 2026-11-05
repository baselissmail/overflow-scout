# Claude Code skills (project scope)

Third-party instructions for the UI work (docs/REFACTOR_PLAN.md §11). Each was
read in full before it was added, and is pinned to the commit below. Update one
by re-fetching it at a new commit, reading the diff, and changing this table.

| Skill                      | Source (pinned commit)                                                                      | License    | Notes                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend-design`          | `anthropics/skills` @ `ca45fc496a3436251f191354091d557da31c15b5`, `skills/frontend-design` | Apache-2.0 | Unchanged.                                                                                                                                     |
| `web-interface-guidelines` | `vercel-labs/web-interface-guidelines` @ `434b7f91364665f2f733b310ec54809bf8f37937`, `command.md` | MIT        | The upstream `web-design-guidelines` skill downloads these rules from `main` on every run, so its instructions can change unreviewed. We pin a copy (`guidelines.md`) behind our own `SKILL.md`. |

| `impeccable` (guidance only) | `pbakaus/impeccable` @ `c8891a9ae865d6ee311836ae5199bfce0fe115b1`, `.agent/skills/impeccable/reference/*.md` | Apache-2.0 | Thirteen reference documents, unchanged, behind our own `SKILL.md`. The upstream skill runs a launcher that downloads and executes a binary, and pre-approves `npx impeccable`; neither its `SKILL.md`, its scripts nor its hooks are vendored. Steps in the references that call the launcher are skipped. |

Bar for adding a skill: released or updated in the last six months, or more
than 2,000 GitHub stars, and read in full first.

Not added:

- `vercel-react-best-practices` (`vercel-labs/agent-skills`): mostly Next.js and
  server guidance, and that repository has no license file. Its client-side
  rules that apply here are summarized in `docs/design/DIRECTION.md`.
- `chrome-extension-ui` (`pproenca/dot-skills`): removed 2026-11-05. It was
  first published in January 2026 and its repository has about 220 stars, so it
  misses the bar above; its rules (side panel width, badge text, focus) are
  covered by Chrome's own documentation, which the project follows.

