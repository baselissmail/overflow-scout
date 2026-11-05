# 0002. activeTab with on-demand injection, no install-time host permissions

- Status: Accepted (spike outcomes recorded below, 2026-11-05)
- Date: 2026-11-04

## Context

v0.1 declared `http://*/*` and `https://*/*` host permissions and a content script on every page. That code ran a MutationObserver, a full DOM walk and a global key listener on every site the user visited. It also triggered the "read and change all your data on all websites" install warning, which slows store review, and caused "reload the page" errors in tabs opened before install.

## Decision

- The required permissions are limited to what features use: `activeTab`, `scripting`, `sidePanel`, `storage`, `contextMenus`. Each is added in the change that first uses it.
- Clicking the toolbar button opens the side panel and grants `activeTab`. The page runtime is injected with `chrome.scripting.executeScript` only when the user starts a scan.
- `http://*/*` and `https://*/*` are listed only as `optional_host_permissions`. They are requested per origin from a user gesture ("Always allow on this site"), so the panel can re-scan after navigation.
- An e2e test asserts the manifest's permissions, so new permissions can't slip in unnoticed.

## Consequences

- No code runs on any page until the user asks. There is no broad install warning.
- After in-tab navigation, re-scanning needs a fresh gesture unless the user opted in for that origin.
- If `activeTab` turns out not to be granted when the panel opens via `openPanelOnActionClick` (spike S1), we fall back to `action.onClicked` → `sidePanel.open({ tabId })` within the same gesture.

## Spike outcomes (Phase 3)

- **S1:** Chrome's activeTab documentation lists the gestures that grant access (executing the action, a context-menu item, a `commands` shortcut, an omnibox suggestion) and doesn't mention opening the side panel through `openPanelOnActionClick`; a 2023 Chromium extensions-forum thread reports it didn't grant access then. Playwright can't click the toolbar to settle it, so we use the documented path: `action.onClicked` → `sidePanel.open({ tabId })`. The click is a gesture, so access is granted. Clicking the button while the panel is open keeps it open and re-grants access (useful after the tab moved to another site).
- **S2:** access lasts while the tab stays on the same origin and is revoked when it navigates to another origin. A navigation ends the page session (the page runtime is gone; stress text with it), and the panel marks its results as from the previous page. Before access, Chrome hides the tab's URL (no `tabs` permission) and its injection errors don't include it, so "Always allow on this site" is offered once the panel is connected and knows the origin.
- **Demo page:** extensions can't inject into their own pages, but `tabs.connect` reaches an extension page's `runtime.onConnect`. The bundled demo page runs the page runtime itself and the panel talks to it exactly as to any site.
