# 0003. Measure on the real element, mutate only text values

- Status: Accepted
- Date: 2026-11-04

## Context

v0.1 measured overflow on a clone appended to `<body>`, copying `getComputedStyle().cssText`. In current Chrome that string is empty, and a detached clone loses every constraint that comes from its parent. A headless Chrome 156 comparison against in-place measurement missed 3 of 6 real overflow cases: descendant selectors, a `truncate` flex child, and `width: 100%` in a constrained parent. Those are the most common real-world patterns. v0.1 also set `element.textContent`, which deletes child icons and replaces nodes owned by frameworks.

## Decision

- All detection measures the real element in its real layout context.
- Stress text is written in one synchronous pass (write all, read all, then restore or keep), so there's a single layout and no intermediate paint.
- Only `Text.nodeValue`, `input.value`, `placeholder` and `<html dir>` are ever changed. Nodes are never added, removed or replaced. Originals are kept in a ledger for lossless revert.
- Nothing is added to page elements (no attributes or classes). Identity is tracked with `WeakMap`s.

## Consequences

- Results match what the user sees, including constraints that come from ancestors.
- React, Vue and Svelte keep their node references, so re-renders don't crash. Re-renders can overwrite stressed text, which we detect and offer to re-apply.
- The page's own MutationObservers see our text changes. This is acceptable, and documented.
- "Revert is lossless" becomes a tested invariant across the fixture corpus.
