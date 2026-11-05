import { defineContentScript } from 'wxt/utils/define-content-script';

import { startPageRuntime } from '@/runtime';

/**
 * The page runtime. Not listed in the manifest: the side panel injects it
 * with `scripting.executeScript` only when the user starts working on a page
 * (docs/adr/0002-active-tab-on-demand-injection.md).
 */
export default defineContentScript({
  registration: 'runtime',
  main() {
    startPageRuntime();
  },
});
