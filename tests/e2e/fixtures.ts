import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  type BrowserContext,
  type Page,
  type Worker,
  test as base,
  chromium,
} from '@playwright/test';
import type { browser } from 'wxt/browser';

/**
 * E2E tests load the `e2e` build (`pnpm build:e2e`). It differs from production
 * only in granting TEST_ORIGIN up front, because Playwright can't click the
 * toolbar button that grants activeTab. manifest.spec.ts checks production.
 */
const extensionPath = fileURLToPath(new URL('../../.output/chrome-mv3-e2e', import.meta.url));

/** Served by request routing; the e2e build has host access to it. */
export const TEST_ORIGIN = 'http://overflow-scout.test';
/** Served too, but the extension has no access to it (like any site before a click). */
export const OTHER_ORIGIN = 'http://other-site.test';

export function fixturePage(path: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${path}`, import.meta.url)), 'utf8');
}

type Chrome = typeof browser;

interface ExtensionFixtures {
  context: BrowserContext;
  /** The extension's service worker, waited for if it hasn't started yet. */
  serviceWorker: Worker;
  extensionId: string;
  /** Opens a URL in a new tab and returns the page with its tab id. */
  openTab: (url: string) => Promise<{ page: Page; tabId: number }>;
  /** Opens the side panel UI in a tab, pinned to work on `tabId`. */
  openPanel: (tabId: number) => Promise<Page>;
}

/**
 * Launches Playwright's bundled Chromium with the built extension loaded.
 * Extensions require a persistent context; branded Chrome and Edge no longer
 * accept the side-loading flags (https://playwright.dev/docs/chrome-extensions).
 */
export const test = base.extend<ExtensionFixtures>({
  // Playwright requires object destructuring for fixture arguments.
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    // Test sites, served without a network.
    await context.route(`${TEST_ORIGIN}/**`, async (route) => {
      const path = new URL(route.request().url()).pathname;
      const page = path === '/next.html' ? 'clipping/fixed-width.html' : 'stress/at-risk.html';
      await route.fulfill({
        contentType: 'text/html',
        body: fixturePage(page),
        // The strictest common policy: no inline styles or scripts at all (plan §13, S3).
        ...(path === '/strict-csp.html' && {
          headers: { 'content-security-policy': "default-src 'none'; style-src 'self'" },
        }),
      });
    });
    await context.route(`${OTHER_ORIGIN}/**`, async (route) => {
      await route.fulfill({ contentType: 'text/html', body: fixturePage('stress/at-risk.html') });
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
  openTab: async ({ context, serviceWorker }, use) => {
    const tabIds = () =>
      serviceWorker.evaluate(async () => {
        const chrome = (globalThis as unknown as { chrome: Chrome }).chrome;
        const tabs = await chrome.tabs.query({});
        return tabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id]));
      });
    await use(async (url) => {
      const before = new Set(await tabIds());
      const page = await context.newPage();
      await page.goto(url);
      const tabId = (await tabIds()).find((id) => !before.has(id));
      if (tabId === undefined) throw new Error(`No new tab for ${url}`);
      return { page, tabId };
    });
  },
  openPanel: async ({ context, extensionId }, use) => {
    await use(async (tabId) => {
      const panel = await context.newPage();
      await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${String(tabId)}`);
      return panel;
    });
  },
});

export const { expect } = test;
