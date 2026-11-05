import { i18n } from '#i18n';
import { browser } from 'wxt/browser';
import type { Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

import type { GestureMessage } from '@/messaging/protocol';
import { LAST_GESTURE_KEY } from '@/messaging/keys';

const INSPECT_MENU_ID = 'inspect-overflow';

/**
 * Opens the side panel for a tab and tells the panel the user just granted
 * access to it. `sidePanel.open` must run inside the gesture, so it is called
 * first and nothing is awaited before it.
 */
function openPanel(tab: Browser.tabs.Tab | undefined, inspect: boolean): void {
  const tabId = tab?.id;
  if (tabId === undefined) return;
  browser.sidePanel.open({ tabId }).catch((error: unknown) => {
    console.error('Overflow Scout: could not open the side panel', error);
  });
  const gesture: GestureMessage = { type: 'gesture', tabId, inspect, at: Date.now() };
  // A panel that is already open hears the message; one that is still
  // starting reads the stored copy.
  void browser.storage.session.set({ [LAST_GESTURE_KEY]: gesture });
  browser.runtime.sendMessage(gesture).catch(() => {
    // No panel listening yet.
  });
}

/**
 * The service worker holds no state (plan §2.3). It opens the panel from the
 * toolbar button, the keyboard shortcut and the context menu; each of these
 * grants activeTab, so the panel can then inject the page runtime
 * (docs/adr/0002-active-tab-on-demand-injection.md).
 */
export default defineBackground(() => {
  // Opening the panel from `action.onClicked` (instead of
  // `openPanelOnActionClick`) guarantees the click grants activeTab (spike S1).
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  browser.action.onClicked.addListener((tab) => {
    openPanel(tab, false);
  });

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: INSPECT_MENU_ID,
      title: i18n.t('contextMenuInspect'),
      contexts: ['page', 'selection', 'link', 'image'],
    });
  });
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === INSPECT_MENU_ID) openPanel(tab, true);
  });
});
