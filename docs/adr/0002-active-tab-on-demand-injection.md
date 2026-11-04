# 0002. activeTab with on-demand injection, no install-time host permissions

- Status: Accepted (spikes S1 and S2 in Phase 3 confirm the details)
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
