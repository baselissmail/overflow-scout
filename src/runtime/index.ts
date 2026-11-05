import { i18n } from '#i18n';
import { browser } from 'wxt/browser';
import type { Browser } from 'wxt/browser';

import { isHtmlElement } from '@/core/dom';
import { PAGE_PORT, pageRequestSchema } from '@/messaging/protocol';

import { PageSession } from './session';

const STARTED = Symbol.for('overflow-scout.page-runtime');

/** `chrome.dom` exists in content scripts, not in extension pages such as the demo. */
function closedShadowRootOpener(): ((element: Element) => ShadowRoot | null) | undefined {
  const dom = (browser as { dom?: typeof browser.dom }).dom;
  if (!dom) return undefined;
  return (element) => (isHtmlElement(element) ? dom.openOrClosedShadowRoot(element) : null);
}

/**
 * Starts the page runtime: waits for the side panel to connect and serves one
 * session per connection. Safe to call more than once (re-injection).
 */
export function startPageRuntime(): void {
  const scope = globalThis as unknown as Record<symbol, boolean | undefined>;
  if (scope[STARTED]) return;
  scope[STARTED] = true;

  let current: { session: PageSession; port: Browser.runtime.Port } | null = null;
  const openShadowRoot = closedShadowRootOpener();

  browser.runtime.onConnect.addListener((port: Browser.runtime.Port) => {
    if (port.name !== PAGE_PORT) return;
    // Only our own extension may drive the page runtime (plan §6.3).
    if (port.sender?.id !== browser.runtime.id) {
      port.disconnect();
      return;
    }
    // A new panel connection replaces the previous one, which is told it ended.
    if (current) {
      current.session.dispose();
      current.port.disconnect();
    }
    const session = new PageSession(
      document,
      (message) => {
        port.postMessage(message);
      },
      {
        ...(openShadowRoot && { openShadowRoot }),
        text: { stressActive: i18n.t('overlay.stressActive'), revert: i18n.t('overlay.revert') },
      },
    );
    current = { session, port };

    port.onMessage.addListener((message: unknown) => {
      const parsed = pageRequestSchema.safeParse(message);
      if (parsed.success) void session.handle(parsed.data);
    });
    port.onDisconnect.addListener(() => {
      // Panel closed, tab switched, or the extension reloaded: leave no trace.
      session.dispose();
      if (current?.session === session) current = null;
    });
  });
}
