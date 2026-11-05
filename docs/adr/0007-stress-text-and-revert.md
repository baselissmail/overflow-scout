# 0007. Stress text: per-string expansion, and the page's own changes win on revert

- Status: Accepted
- Date: 2026-11-05

## Context

The stress test (plan §4) lengthens every string on a live page that is often a running React, Vue or Svelte app. Three questions came up while building it:

1. **What is a "string"?** Translators work on whole messages, but the DOM splits them into text nodes: `You have <b>3</b> unread messages` is four nodes. Expanding each node by its own length would treat "You have " as a 9-character string and grow it far more than the 26-character message it belongs to.
2. **What if the app re-renders while stress is active?** Frameworks overwrite text they own when their state changes (a counter, a renamed item). Restoring our saved original over that would put stale text on screen and leave the DOM out of sync with the framework's virtual DOM until its next update.
3. **What must never be touched?** Some text isn't translated, and some editable regions persist whatever is in the DOM.

## Decision

- **A string is the text of one block.** Text nodes are grouped by their nearest ancestor whose `display` isn't inline. The expansion comes from the whole string's length (plan §4.1 table), and the growth is split across its pieces in proportion to their length. Pieces without letters (numbers, prices, spaces between elements) count toward the length but are never rewritten.
- **The page's own changes win.** The ledger writes only `Text.data` and the `placeholder`, `value` (button inputs) and root `dir` attributes. Revert restores a value only if it still holds exactly what we wrote. If the page changed it, the page's value is kept and counted (`keptPageChanges`). The next apply treats that value as the new original.
- **Re-renders are reported, not fought.** A MutationObserver counts strings the page changed or added since stress was applied (`pending()` / `watch()`), so the UI can offer "Page re-rendered 12 strings · Re-apply". Text added inside `<style>`, `<script>` and other skipped subtrees, such as CSS-in-JS rules, is ignored.
- **Never stressed:** `contenteditable` regions (editors would save stress text into the user's document), `translate="no"` and `.notranslate` content, `code`/`kbd`/`samp`/`var`, ligature icon fonts (Material Icons/Symbols draw words like "search" as icons), and values typed into text fields.
- **Generation is deterministic.** Each string is seeded from its own text and the session seed, so identical strings get identical stress text and every run is reproducible.

## Consequences

- Expansion matches how translators see messages, and numbers inside messages stay readable.
- Revert is byte-for-byte when the page didn't change, which is tested on every corpus page with every strategy. When the page did change, the result matches what the app renders. That is tested with React 19, Vue 3 and Svelte 5 apps that re-render (text updates, keyed moves, insertions, attribute changes) while stressed and are compared with an unstressed copy.
- Button inputs (`type="submit"` and similar) are stressed, but the scanner doesn't yet measure their labels. That gap is tracked for Phase 5.
