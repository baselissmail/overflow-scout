import type { Page } from '@playwright/test';
import type { browser } from 'wxt/browser';

import { OTHER_ORIGIN, TEST_ORIGIN, expect, test } from './fixtures';

type Chrome = typeof browser;

const results = (panel: Page) => panel.getByRole('listbox', { name: 'Results' });
const rows = (panel: Page) => results(panel).getByRole('option');
const pageText = (page: Page) => page.evaluate(() => document.body.innerHTML);

/** Scans from Home, or from the action bar once there are results. */
async function scan(panel: Page): Promise<void> {
  await panel
    .getByRole('button', { name: /^(Scan page|Scan again)/ })
    .first()
    .click();
}

async function runStress(panel: Page): Promise<void> {
  const form = panel.getByRole('form', { name: 'Stress test' });
  if (!(await form.isVisible())) await panel.getByRole('button', { name: /^Stress test/ }).click();
  await form.getByRole('button', { name: 'Apply and scan' }).click();
  await expect(panel.getByRole('button', { name: 'Revert' })).toBeVisible();
}

test.describe('demo page', () => {
  test('scans, highlights and reveals results, without network requests', async ({
    extensionId,
    openTab,
    openPanel,
    serviceWorker,
  }) => {
    const { page: demo, tabId } = await openTab(`chrome-extension://${extensionId}/demo.html`);
    // Narrow enough for the promo line to cause horizontal scroll.
    await demo.setViewportSize({ width: 800, height: 900 });
    const panel = await openPanel(tabId);
    const requests: string[] = [];
    panel.on('request', (request) => requests.push(request.url()));

    await scan(panel);
    await expect(rows(panel).first()).toBeVisible();
    const filters = panel.getByRole('group', { name: 'Filter by kind' });
    for (const kind of ['Hidden', 'Truncated', 'Spilling', 'Page scroll', 'Input']) {
      await expect(
        filters.getByRole('button', { name: new RegExp(`^${kind} \\d+`) }),
      ).toBeVisible();
    }
    await expect(panel.getByText(/text nodes · \d+ ms · 800×/)).toBeVisible();

    // Hovering a result outlines it on the page; clicking scrolls to it and opens details.
    await rows(panel).first().hover();
    await expect(demo.locator('overflow-scout-root .box[data-role="target"]')).toHaveCount(1);
    await rows(panel).first().click();
    await expect(demo.locator('overflow-scout-root .box[data-flash]')).toHaveCount(1);
    await expect(panel.getByRole('img', { name: /^Needs .* short\.$/ })).toBeVisible();

    // Revealing an element below the fold scrolls the page; the pulse must survive the redraws.
    await demo.setViewportSize({ width: 800, height: 300 });
    await rows(panel).filter({ hasText: 'Ships in 2–3 business days' }).click();
    await expect(demo.locator('overflow-scout-root .box[data-flash]')).toHaveCount(1);
    await expect.poll(() => demo.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    const badge = await serviceWorker.evaluate(
      (id) =>
        (globalThis as unknown as { chrome: Chrome }).chrome.action.getBadgeText({ tabId: id }),
      tabId,
    );
    expect(Number(badge)).toBeGreaterThan(0);
    // Everything runs locally (plan §6.4).
    expect(requests.filter((url) => !url.startsWith('chrome-extension://'))).toEqual([]);
  });

  test('stress-tests the page and reverts it exactly', async ({
    extensionId,
    openTab,
    openPanel,
  }) => {
    const { page: demo, tabId } = await openTab(`chrome-extension://${extensionId}/demo.html`);
    const panel = await openPanel(tabId);
    const before = await pageText(demo);

    await runStress(panel);
    await expect(panel.getByRole('tab', { name: /^With longer text/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(rows(panel).first()).toBeVisible();
    expect(await pageText(demo)).not.toBe(before);
    await expect(demo.locator('overflow-scout-root .pill')).toContainText('Stress test active');

    await panel.getByRole('button', { name: 'Revert' }).click();
    await expect(panel.getByRole('button', { name: 'Revert' })).toBeHidden();
    expect(await pageText(demo)).toBe(before);
    await expect(demo.locator('overflow-scout-root .pill')).toHaveCount(0);
  });

  test('reverts from the button on the page', async ({ extensionId, openTab, openPanel }) => {
    const { page: demo, tabId } = await openTab(`chrome-extension://${extensionId}/demo.html`);
    const panel = await openPanel(tabId);
    const before = await pageText(demo);

    await runStress(panel);
    await demo.locator('overflow-scout-root .pill').getByRole('button', { name: 'Revert' }).click();
    await expect(panel.getByRole('button', { name: 'Revert' })).toBeHidden();
    expect(await pageText(demo)).toBe(before);
  });

  test('inspects an element with the picker', async ({ extensionId, openTab, openPanel }) => {
    const { page: demo, tabId } = await openTab(`chrome-extension://${extensionId}/demo.html`);
    const panel = await openPanel(tabId);

    await panel.getByRole('button', { name: /^Inspect element/ }).click();
    await expect(panel.getByText('Click an element on the page.', { exact: false })).toBeVisible();
    const button = demo.getByRole('button', { name: 'Add to cart' }).first();
    const box = await button.boundingBox();
    if (!box) throw new Error('The demo button has no box');
    await demo.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    const card = panel.getByRole('region', { name: 'Inspect' });
    await expect(card).toContainText('Add to cart');
    await expect(card).toContainText(/Fits up to \d+ characters|Still fits/);
    await expect(card).toContainText(/a translation needs about 20–22/);
  });
});

test.describe('other pages', () => {
  test('injects the runtime, and closing the panel reverts the page', async ({
    openTab,
    openPanel,
  }) => {
    const { page, tabId } = await openTab(`${TEST_ORIGIN}/`);
    const panel = await openPanel(tabId);
    const before = await pageText(page);

    await scan(panel);
    await expect(rows(panel)).toHaveCount(1);
    await runStress(panel);
    expect(await pageText(page)).not.toBe(before);

    await panel.close();
    await expect.poll(() => pageText(page)).toBe(before);
    await expect(page.locator('overflow-scout-root')).toHaveCount(0);
  });

  test('offers to re-apply stress text the page re-rendered', async ({ openTab, openPanel }) => {
    const { page, tabId } = await openTab(`${TEST_ORIGIN}/`);
    const panel = await openPanel(tabId);

    await runStress(panel);
    await page.evaluate(() => {
      const tab = document.querySelector('.tab')?.firstChild;
      if (tab instanceof Text) tab.data = 'Overview';
    });
    await expect(panel.getByText('1 string was reset by the page.')).toBeVisible();
    await panel.getByRole('button', { name: 'Re-apply' }).click();
    await expect(panel.getByText('1 string was reset by the page.')).toBeHidden();
    expect(await page.locator('.tab').first().textContent()).not.toBe('Overview');
  });

  test('marks results stale after navigation and scans the new page', async ({
    openTab,
    openPanel,
  }) => {
    const { page, tabId } = await openTab(`${TEST_ORIGIN}/`);
    const panel = await openPanel(tabId);

    await scan(panel);
    await expect(rows(panel)).toHaveCount(1);
    await page.goto(`${TEST_ORIGIN}/next.html`);
    const stale = panel
      .getByRole('status')
      .filter({ hasText: 'Results are from the previous page.' });
    await expect(stale).toBeVisible();

    await stale.getByRole('button', { name: 'Scan again' }).click();
    await expect(panel.getByText('Results are from the previous page.')).toBeHidden();
    await expect.poll(() => rows(panel).count()).toBeGreaterThan(1);
  });

  test('draws its overlay on pages with a strict content security policy', async ({
    openTab,
    openPanel,
  }) => {
    const { page, tabId } = await openTab(`${TEST_ORIGIN}/strict-csp.html`);
    const panel = await openPanel(tabId);

    await runStress(panel);
    const pill = page.locator('overflow-scout-root .pill');
    await expect(pill).toBeVisible();
    // The overlay's stylesheet applied despite the policy: the pill is a styled, fixed box.
    expect(await pill.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
    await panel.getByRole('button', { name: 'Revert' }).click();
    await expect(pill).toHaveCount(0);
  });

  test('explains pages Chrome does not allow', async ({ openTab, openPanel }) => {
    const { tabId } = await openTab('chrome://version');
    const panel = await openPanel(tabId);

    await scan(panel);
    await expect(panel.getByText("Chrome doesn't allow extensions on this page.")).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Open the demo page' })).toBeVisible();
  });

  test('asks for access on sites it has not been granted', async ({ openTab, openPanel }) => {
    const { tabId } = await openTab(`${OTHER_ORIGIN}/`);
    const panel = await openPanel(tabId);

    await scan(panel);
    // The shortcut shown is the one Chrome reports, as the user has it set.
    await expect(panel.getByText(/^Click the Overflow Scout button in the toolbar/)).toBeVisible();
  });

  test('shows the site and its access once connected', async ({ openTab, openPanel }) => {
    const { tabId } = await openTab(`${TEST_ORIGIN}/`);
    const panel = await openPanel(tabId);

    await scan(panel);
    await expect(panel.getByText('overflow-scout.test')).toBeVisible();
    // The e2e build is granted this origin, so there is nothing to ask for.
    await expect(panel.getByText('Always allowed on this site')).toBeVisible();
  });
});
