# 0008. Panel ↔ page: one port, a typed request/reply protocol, and an e2e build mode

- Status: Accepted
- Date: 2026-11-05

## Context

The side panel drives the page runtime: scans, stress tests, highlights, the picker. Plan §2.3 puts a long-lived port between them so the service worker, which Chrome suspends freely, stays out of the hot path. The plan listed `@webext-core/messaging` for typed messages. End-to-end tests also need the extension to work on a test page, but Playwright can't click the toolbar button that grants `activeTab`.

## Decision

- **One port per session** (`chrome.tabs.connect`, name `overflow-scout/page`), opened from the panel. The panel first tries to connect; only if nothing answers does it inject the runtime (`scripting.executeScript`) and connect again. Injection is idempotent.
- **Request/reply over the port**, defined once in `src/messaging/protocol.ts`: each request carries an id; the page answers with `result` or `error`, and pushes events (`pending`, `reverted`, `picked`). Both sides validate every message with zod. The page checks `port.sender.id === chrome.runtime.id` and ignores other ports. `zod/mini` keeps the page runtime at 28 kB gzip. This replaces `@webext-core/messaging`: with a single port and request ids, a library adds weight without removing code.
- **The port is the session.** When it disconnects (panel closed, extension reloaded, page navigated or entering the back/forward cache), the page reverts stress text and removes its overlay. No timers or heartbeats are needed.
- **One session per tab, kept while the panel is open** (2026-11-08). Switching tabs used to close the port, so coming back to a tab showed nothing, which read as a reset. Now the panel keeps each tab's port and results while it looks at another tab: longer text stays on that page (its own "Back to normal" button still works), and the picker, tried text, a previewed fix and outlines are cleared. Coming back shows the tab as it was left. Closing the panel or the tab still closes the port, so no page stays changed once the panel is gone.
- **Findings stay on the page.** The page sends plain data with ids and keeps the live elements, so highlight and reveal requests name an id. Unique selectors are computed only for the first instance of each issue (they cost up to ~50 ms each).
- **An `e2e` build mode** (`pnpm build:e2e`) is the production build plus host access to one test origin (`http://overflow-scout.test/*`), served by Playwright's request routing. A separate test reads the production manifest and checks it has no host permissions.

## Consequences

- The service worker only opens the panel and relays gestures; it holds no state and is 1.1 kB gzip.
- Tests run the real injection and messaging paths. What they can't run (toolbar, shortcut and context-menu gestures) is a short manual check before release.
