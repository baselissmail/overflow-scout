import { useEffect, useState, useSyncExternalStore } from 'react';
import { browser } from 'wxt/browser';

import type { IssueDto } from '@/messaging/protocol';
import { LAST_GESTURE_KEY, gestureMessageSchema } from '@/messaging/protocol';

import { PageConnection } from './connection';
import type { PanelState } from './controller';
import { PanelController } from './controller';

/** A gesture older than this was meant for an earlier panel. */
const GESTURE_FRESH_MS = 10_000;

function setBadge(tabId: number, issues: readonly IssueDto[] | null): void {
  const count = issues?.length ?? 0;
  const text = issues === null || count === 0 ? '' : count > 999 ? '999+' : String(count);
  const critical = issues?.some((issue) => issue.severity === 'critical') ?? false;
  void browser.action.setBadgeText({ tabId, text }).catch(() => undefined);
  if (text) {
    void browser.action
      .setBadgeBackgroundColor({ tabId, color: critical ? '#ce2c31' : '#ab6400' })
      .catch(() => undefined);
  }
}

/**
 * The tab the panel works on. `?tab=<id>` pins it (a panel opened in its own
 * tab, and e2e tests); otherwise it follows the active tab of the window.
 */
function pinnedTab(): number | null {
  const value = new URLSearchParams(location.search).get('tab');
  const id = value === null ? Number.NaN : Number(value);
  return Number.isInteger(id) && id >= 0 ? id : null;
}

/** Wires the panel controller to the browser: target tab, navigation, gestures. */
export function usePanel(): { state: PanelState; controller: PanelController } {
  const [controller] = useState(
    () => new PanelController({ connect: (tabId) => PageConnection.open(tabId), setBadge }),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getState);

  useEffect(() => {
    let disposed = false;
    const pinned = pinnedTab();
    let windowId: number | undefined;

    const consumeStoredGesture = async (tabId: number) => {
      const stored = await browser.storage.session.get(LAST_GESTURE_KEY);
      const gesture = gestureMessageSchema.safeParse(stored[LAST_GESTURE_KEY]);
      if (!gesture.success || gesture.data.tabId !== tabId) return;
      if (Date.now() - gesture.data.at > GESTURE_FRESH_MS) return;
      await browser.storage.session.remove(LAST_GESTURE_KEY);
      await controller.gesture(tabId, gesture.data.inspect);
    };

    const start = async () => {
      if (pinned !== null) {
        controller.setTarget(pinned);
        return;
      }
      const current = await browser.windows.getCurrent();
      windowId = current.id;
      const [tab] = await browser.tabs.query({ active: true, windowId });
      if (disposed) return;
      controller.setTarget(tab?.id ?? null);
      if (tab?.id !== undefined) await consumeStoredGesture(tab.id);
    };

    const onActivated = (info: { tabId: number; windowId: number }) => {
      if (pinned === null && info.windowId === windowId) controller.setTarget(info.tabId);
    };
    const onUpdated = (tabId: number, change: { status?: string }) => {
      if (tabId === controller.getState().tabId && change.status === 'loading') {
        controller.navigated();
      }
    };
    const onRemoved = (tabId: number) => {
      if (tabId === controller.getState().tabId) controller.setTarget(null);
    };
    const onMessage = (raw: unknown, sender: { id?: string }) => {
      if (sender.id !== browser.runtime.id) return;
      const gesture = gestureMessageSchema.safeParse(raw);
      if (gesture.success) void controller.gesture(gesture.data.tabId, gesture.data.inspect);
    };

    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(onRemoved);
    browser.runtime.onMessage.addListener(onMessage);
    void start();

    return () => {
      disposed = true;
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(onRemoved);
      browser.runtime.onMessage.removeListener(onMessage);
      controller.dispose();
    };
  }, [controller]);

  return { state, controller };
}
