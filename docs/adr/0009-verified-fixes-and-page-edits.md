# 0009. Verified fixes, tried text and screenshots: how the panel may touch the page

- Status: Accepted
- Date: 2026-11-05

## Context

Phase 5 lets the panel change the page in three new ways: it tries CSS fixes (plan §3.5), it puts other text into a measured element (§5.3, Inspect), and it captures the tab for screenshots. The page belongs to the user. Every change has to be visible or invisible on purpose, reversible exactly, and must not break the stress test's own bookkeeping (ADR 0007).

## Decision

- **Fix trials are invisible.** Each CSS fix is written as inline `!important` styles with transitions off, measured with a scan scoped to the finding's element, and the `style` attribute string is restored exactly, all in one task, so nothing paints. Chrome syncs CSSOM edits to the attribute lazily, so restoring writes the attribute before removing it; otherwise `style=""` is left behind.
- **When a trial only moves the overflow** (wrapped text now clipped by a fixed height), the engine adds the matching height fix and tries the fixes together. The diagnosis can't see this; only a trial can.
- **Previews and tried text are visible, and end on their own.** A previewed fix or a tried text stays on the page until it's stopped, the details or card close, another element is picked, or any scan, stress test or revert starts. Results always describe the page as it is.
- **Tried text keeps the element's nodes** and, when undone, leaves any node the page changed meanwhile alone, the rule ADR 0007 set for stress text. While text is tried, the stress watcher's "changed back by the page" count is held back, because that change is ours.
- **Screenshots use `activeTab` only.** `tabs.captureVisibleTab` needs `activeTab` or `<all_urls>`; per-site access isn't enough. A click on the toolbar button grants `activeTab`, which is how the panel is usually opened. When Chrome refuses, the panel says to click the button and try again. We don't ask for `<all_urls>`: access to every site isn't worth a screenshot button.
- **Ignore rules match the issue's fingerprint** (kind, element signature, parent signature) per site, not a selector, so they hold across scans, stress tests and small DOM changes. They're stored on the device only.

## Consequences

- "What to do" states facts ("Fixes it. The box gets 22 px taller.") instead of guesses, and reports carry the same verdicts.
- The page runtime grew from 29.4 to 31.4 kB gzip (budget 35).
- e2e can't grant `activeTab`, so it covers the refusal message; cropping is tested in a real browser with a synthetic capture (`tests/panel`). Screenshots after a real toolbar click join the manual pre-release check from ADR 0008.
