/**
 * Chrome Web Store screenshots (pnpm store:screenshots, after pnpm build):
 * five 1280×800 images of the production build on the demo page, the page on
 * the left and the side panel on the right, as Chrome shows them, with one
 * short caption each. The store shows them at 640×400, so captions are large.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import type { browser } from 'wxt/browser';

const root = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const OUT = root('store/screenshots/');
const PAGE = { width: 880, height: 800 };
const PANEL = { width: 400, height: 800 };

async function launch(): Promise<{ context: BrowserContext; profile: string }> {
  const profile = join(tmpdir(), `overflow-scout-store-${String(Date.now())}`);
  const extension = root('.output/chrome-mv3');
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    deviceScaleFactor: 1,
  });
  return { context, profile };
}

async function compose(
  context: BrowserContext,
  demo: Page,
  panel: Page,
  caption: string,
  file: string,
): Promise<void> {
  // Let animations (count-ups, arrival, pulses) settle before the capture.
  await panel.waitForTimeout(900);
  const page = (await demo.screenshot()).toString('base64');
  const side = (await panel.screenshot()).toString('base64');
  const sheet = await context.newPage();
  await sheet.setViewportSize({ width: 1280, height: 800 });
  await sheet.setContent(`<!doctype html><html><body style="margin:0;display:flex;width:1280px;height:800px;overflow:hidden;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
    <div style="position:relative;width:${String(PAGE.width)}px;height:800px">
      <img src="data:image/png;base64,${page}" style="display:block">
      <p style="position:absolute;left:28px;bottom:28px;margin:0;max-width:760px;padding:14px 20px;border-radius:12px;background:rgb(20 22 27 / 0.88);color:#fff;font-size:28px;line-height:1.25;font-weight:600;letter-spacing:-0.01em">${caption}</p>
    </div>
    <img src="data:image/png;base64,${side}" style="display:block;border-left:1px solid #c9cdd6">
  </body></html>`);
  await sheet.screenshot({ path: `${OUT}${file}`, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  await sheet.close();
  process.stdout.write(`store/screenshots/${file}\n`);
}

async function main(): Promise<void> {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const { context, profile } = await launch();
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const tabIds = () =>
      worker.evaluate(async () => {
        const chrome = (globalThis as unknown as { chrome: typeof browser }).chrome;
        return (await chrome.tabs.query({})).flatMap((tab) =>
          tab.id === undefined ? [] : [tab.id],
        );
      });
    const before = new Set(await tabIds());
    const demo = await context.newPage();
    await demo.setViewportSize(PAGE);
    await demo.goto(`chrome-extension://${id}/demo.html`);
    const tabId = (await tabIds()).find((tab) => !before.has(tab)) ?? -1;
    const panel = await context.newPage();
    await panel.setViewportSize(PANEL);
    await panel.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await panel.goto(`chrome-extension://${id}/sidepanel.html?tab=${String(tabId)}`);
    const rows = panel.getByRole('listbox', { name: 'Results' }).getByRole('option');

    // 1. Scan: what's cut off, with the hovered result outlined on the page.
    await panel.getByRole('button', { name: /^Scan page/ }).click();
    await rows.first().waitFor();
    await rows.first().hover();
    await compose(
      context,
      demo,
      panel,
      'Find text that’s cut off, truncated or overflowing',
      '1-scan.png',
    );

    // 2. Details: each fix tried on the page.
    await rows.filter({ hasText: 'Waterproof hiking jacket' }).click();
    await panel.getByText(/^Fixes it\./).waitFor();
    await compose(
      context,
      demo,
      panel,
      'Every fix is tried on the page, then put back',
      '2-fixes.png',
    );

    // 3. Longer text: what breaks once the page is translated.
    await panel.keyboard.press('Escape');
    await panel.getByRole('button', { name: /^(Longer text|Test with longer text)/ }).click();
    await panel.getByRole('button', { name: 'Apply and scan' }).click();
    await panel.getByRole('button', { name: 'Revert' }).waitFor();
    await rows.first().waitFor();
    await demo.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await compose(
      context,
      demo,
      panel,
      'See what breaks once your text is translated',
      '3-longer-text.png',
    );

    // 4. Measure: how much fits, with real-world text tried live.
    await panel.getByRole('button', { name: 'Revert' }).click();
    // A clean panel: no earlier results, and the "Page restored" toast gone.
    await panel.getByRole('button', { name: 'Clear results' }).click();
    await panel.waitForTimeout(4500);
    await panel.getByRole('button', { name: /^(Measure an element|Measure$)/ }).click();
    const target = await demo.locator('article.card button.buy').first().boundingBox();
    if (!target) throw new Error('The demo button has no box');
    await demo.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
    const card = panel.getByRole('region', { name: 'Measure' });
    await card.getByRole('button', { name: 'Name' }).click();
    await card.getByText(/at \d+ characters|Fits at/).waitFor();
    await card.getByRole('heading', { name: 'Try other text' }).scrollIntoViewIfNeeded();
    await compose(
      context,
      demo,
      panel,
      'Measure how much text fits, with real names and links',
      '4-measure.png',
    );

    // 5. Dark theme and a report for the bug tracker.
    await card.getByRole('button', { name: 'Close measurement' }).click();
    await panel.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await panel.getByRole('button', { name: /^Scan (page|again)/ }).click();
    await rows.filter({ hasText: 'Waterproof hiking jacket' }).click();
    await panel.getByText(/^Fixes it\./).waitFor();
    await panel.getByRole('button', { name: 'Export results' }).click();
    await panel.getByRole('button', { name: 'Copy report (Markdown)' }).waitFor();
    await compose(
      context,
      demo,
      panel,
      'Copy a report for GitHub or Jira. Nothing leaves your browser.',
      '5-report.png',
    );
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
}

await main();
