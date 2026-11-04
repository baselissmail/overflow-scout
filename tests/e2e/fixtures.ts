import { fileURLToPath } from 'node:url';

import { type BrowserContext, type Worker, test as base, chromium } from '@playwright/test';
import type { Browser, browser } from 'wxt/browser';

const extensionPath = fileURLToPath(new URL('../../.output/chrome-mv3', import.meta.url));

interface ExtensionFixtures {
  context: BrowserContext;
  /** The extension's service worker, waited for if it hasn't started yet. */
  serviceWorker: Worker;
  extensionId: string;
  /** The manifest as Chrome loaded it (read from inside the service worker). */
  manifest: Browser.runtime.Manifest;
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
  manifest: async ({ serviceWorker }, use) => {
    // The callback runs inside the service worker, where the `chrome` global exists.
    const manifest = await serviceWorker.evaluate(() =>
      (globalThis as unknown as { chrome: typeof browser }).chrome.runtime.getManifest(),
    );
    await use(manifest);
  },
});

export const { expect } = test;
