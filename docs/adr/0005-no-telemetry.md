# 0005. No telemetry or network access

- Status: Accepted
- Date: 2026-11-04

## Context

The extension reads the content of whatever pages users test, often internal staging apps. Trust is a core part of the product.

## Decision

- No analytics, crash reporting or other network requests from any extension context. All processing is local.
- Feedback comes through explicit user actions instead. "Report false positive" opens a prefilled GitHub issue that the user reviews before sending; page text is excluded by default.
- An e2e test (Phase 3) asserts that extension contexts make zero network requests.

## Consequences

- The privacy policy and the Chrome Web Store data disclosure are simple ("no data collected").
- Product decisions rely on qualitative feedback and dogfooding rather than usage metrics. Opt-in anonymous counts can be revisited after launch with a new ADR.
