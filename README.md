# Overflow Scout

Find text that gets cut off, before your users or translators do.

> **Status:** v1 rebuild in progress. The v0.1 prototype is tagged `v0.1.0-legacy`. The
> roadmap lives in [docs/REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md).

Overflow Scout is a Chrome extension for frontend engineers, QA and designers. It will:

- **Scan** a page for text that is clipped, truncated or causing horizontal scroll, without changing it.
- **Stress-test** every string at realistic translation lengths (or pseudo-locale) and show what breaks.
- **Inspect** an element to find its exact breaking point, and suggest CSS fixes it has verified on the live page.

Everything runs locally in your browser. No data leaves your device.

## Using it

Click the Overflow Scout button in the toolbar (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>)
to open the side panel for the current tab, then choose **Scan page**, **Test with longer text**
or **Measure an element**. Right-click a page and choose **Measure this element with Overflow
Scout** to go straight to the picker. Nothing runs on a page until you ask, and closing the panel puts the page back
exactly as it was. **Try the demo page** in the panel opens a page with overflow bugs on purpose.

## Development

Requirements: Node (version in [.nvmrc](.nvmrc)) and pnpm (version pinned in `package.json`).

```sh
pnpm install                           # also installs git hooks
pnpm exec playwright install chromium  # once, for engine and e2e tests
pnpm dev                               # Chrome with the extension loaded and hot reload
```

| Command             | What it does                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build`        | Production build in `.output/chrome-mv3`                                                                                     |
| `pnpm zip`          | Store-ready zip                                                                                                              |
| `pnpm check`        | Types, lint, formatting, unit and engine tests                                                                               |
| `pnpm test`         | Unit tests (Node)                                                                                                            |
| `pnpm test:browser` | Engine and framework tests in real Chromium                                                                                  |
| `pnpm build:e2e`    | Build for e2e tests (production + access to a test origin)                                                                   |
| `pnpm test:e2e`     | End-to-end tests (run `pnpm build && pnpm build:e2e` first)                                                                  |
| `pnpm size`         | Bundle size budgets (build first)                                                                                            |
| `pnpm dogfood`      | Run the engine on real sites and write contact sheets to `.dogfood/` (needs the network; [results](docs/dogfood/2026-11.md)) |

To load a build manually, open `chrome://extensions`, enable Developer mode, choose
**Load unpacked** and select `.output/chrome-mv3`.

### Project layout

```
src/
  entrypoints/  background service worker, side panel (and later the page runtime)
  core/         pure detection and text logic: no extension or UI APIs
  ui/           design tokens and components
  locales/      UI strings (en)
tests/
  engine/       Vitest browser-mode tests (real layout)
  frameworks/   The same app in React, Vue and Svelte, stressed while it re-renders
  e2e/          Playwright tests with the built extension
docs/
  REFACTOR_PLAN.md   roadmap and specification
  adr/               architecture decision records
```

Layer rules are enforced by ESLint (`eslint-plugin-boundaries`); see
[docs/REFACTOR_PLAN.md §2.4](docs/REFACTOR_PLAN.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Basel Issmail
