import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  // The toolbar button opens the side panel; nothing runs on a page until the
  // user starts a scan from there (docs/adr/0002-active-tab-on-demand-injection.md).
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => {
    console.error('Overflow Scout: could not configure the side panel', error);
  });
});
