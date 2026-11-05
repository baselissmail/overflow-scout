import { readFile } from 'node:fs/promises';

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
  const form = panel.getByRole('form', { name: 'Test with longer text' });
  if (!(await form.isVisible()))
    await panel.getByRole('button', { name: /^(Test with longer text|Longer text)/ }).click();
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
    for (const kind of [
      'Cut off',
      'Truncated',
      'Overflows',
      'Wider than window',
      'Field cut off',
    ]) {
      await expect(
        filters.getByRole('button', { name: new RegExp(`^${kind} \\d+`) }),
      ).toBeVisible();
    }
    await expect(panel.getByText(/texts checked · \d+ ms · window 800×/)).toBeVisible();

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

    // Clearing the results goes back to the start screen.
    await panel.getByRole('button', { name: 'Clear results' }).click();
    await expect(results(panel)).toBeHidden();
    await expect(panel.getByRole('button', { name: /^Scan page/ })).toBeVisible();
  });

  test('tries each fix on the page, and previews one until it is stopped', async ({
    extensionId,
    openTab,
    openPanel,
  }) => {
    const { page: demo, tabId } = await openTab(`chrome-extension://${extensionId}/demo.html`);
    await demo.setViewportSize({ width: 800, height: 900 });
    const panel = await openPanel(tabId);
    const title = demo.locator('h2.title').first();
    const before = await pageText(demo);

    await scan(panel);
    await rows(panel).filter({ hasText: 'Waterproof hiking jacket' }).click();
    // The fixed height is the cause; growing the box is verified to fix it.
    const fix = panel.getByRole('listitem').filter({ hasText: 'min-height' });
    await expect(fix).toContainText(/Fixes it\. The box gets [\d.]+\s?px taller\./);
    await expect(panel.getByText('Each fix was tried on the page for a moment')).toBeVisible();
    // Trying left the page exactly as it was.
    expect(await pageText(demo)).toBe(before);

    await fix.getByRole('button', { name: 'Preview on page' }).click();
    await expect.poll(() => title.getAttribute('style')).toContain('height: auto');
    await fix.getByRole('button', { name: 'Stop preview' }).click();
    await expect.poll(() => title.getAttribute('style')).toBeNull();

    // Closing the details takes a preview off the page too.
    await fix.getByRole('button', { name: 'Preview on page' }).click();
    await expect.poll(() => title.getAttribute('style')).toContain('height: auto');
    await panel.keyboard.press('Escape');
    await expect.poll(() => pageText(demo)).toBe(before);
  });

  test('copies an issue report and exports every result', async ({
    extensionId,
    openTab,
    openPanel,
  }) => {
    const { page: demo, tabId } = await openTab(`chrome-extension://${extensionId}/demo.html`);
    await demo.setViewportSize({ width: 800, height: 900 });
    const panel = await openPanel(tabId);

    // Extension origins can't be granted clipboard-read; keep what the panel writes instead.
    await panel.evaluate(() => {
      const copied: string[] = [];
      Object.assign(window, { copied });
      navigator.clipboard.writeText = (text: string) => {
        copied.push(text);
        return Promise.resolve();
      };
    });

    await scan(panel);
    await rows(panel).filter({ hasText: 'Waterproof hiking jacket' }).click();
    await expect(panel.getByText(/^Fixes it\./)).toBeVisible();
    await panel.getByRole('button', { name: 'Copy report' }).click();
    await expect(panel.getByRole('button', { name: 'Copied' })).toBeVisible();
    const report = await panel.evaluate(
      () => (window as unknown as { copied: string[] }).copied.at(-1) ?? '',
    );
    expect(report).toMatch(
      /^### Cut off: `section\.grid › article\.card › h2\.title` \(2 places\)\n/,
    );
    expect(report).toContain(
      `- **Page:** chrome-extension://${extensionId}/demo.html · window 800×900 · Chrome `,
    );
    expect(report).toMatch(/- \*\*Size:\*\* Needs [\d.]+\s?px of height, has 44\s?px/);
    expect(report).toContain('- **Fixes, tried on the page:**');
    expect(report).toMatch(/`height: auto; min-height: 44px;` on `[^`]+`: Fixes it\./);

    await panel.getByRole('button', { name: 'Export results' }).click();
    const [download] = await Promise.all([
      panel.waitForEvent('download'),
      panel.getByRole('button', { name: 'Save as JSON' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^overflow-scout-.+-\d{4}-\d{2}-\d{2}-\d{4}\.json$/,
    );
    const path = await download.path();
    const data = JSON.parse(await readFile(path, 'utf8')) as { format: string; issues: unknown[] };
    expect(data.format).toBe('overflow-scout/results');
    expect(data.issues.length).toBeGreaterThan(3);
  });

  test('ignores an issue on this site until it is shown again', async ({
    extensionId,
    openTab,
    openPanel,
  }) => {
    const { page: demo, tabId } = await openTab(`chrome-extension://${extensionId}/demo.html`);
    await demo.setViewportSize({ width: 800, height: 900 });
    const panel = await openPanel(tabId);
    const jacket = rows(panel).filter({ hasText: 'Waterproof hiking jacket' });

    await scan(panel);
    await expect(jacket).toBeVisible();
    const total = await rows(panel).count();
    await jacket.click();
    await panel.getByRole('button', { name: 'Ignore on this site' }).click();
    await expect(jacket).toHaveCount(0);
    await expect(rows(panel)).toHaveCount(total - 1);

    // It stays ignored across scans: the rule matches the issue's fingerprint.
    await scan(panel);
    await expect(rows(panel)).toHaveCount(total - 1);
    await panel.getByRole('button', { name: 'Show 1 ignored' }).click();
    await expect(jacket).toContainText('Ignored');
    await jacket.click();
    await panel.getByRole('button', { name: 'Stop ignoring' }).click();
    await expect(panel.getByRole('button', { name: /ignored/i })).toHaveCount(0);
    await expect(jacket).not.toContainText('Ignored');

    // Ignored results are listed in Settings, by site, to undo later.
    await panel.getByRole('button', { name: 'Ignore on this site' }).click();
    await panel.getByRole('button', { name: 'Settings' }).click();
    const group = panel.getByRole('region', { name: 'Ignored results' });
    await expect(group).toContainText('Cut off · Demo page');
    await group.getByRole('button', { name: /^Stop ignoring/ }).click();
    await expect(group).toContainText('None yet.');
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
    await expect(panel.getByRole('tab', { name: /^New with longer text/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(rows(panel).first()).toBeVisible();
    expect(await pageText(demo)).not.toBe(before);
    await expect(demo.locator('overflow-scout-root .pill')).toContainText('Longer test text on');
    // The results say how they were made, and the odd-looking text is explained.
    await expect(
      panel.getByText(
        /^Translation length · Realistic · [\d.]+× longer: \d+ new, \d+ already broken$/,
      ),
    ).toBeVisible();
    await expect(panel.getByText(/accented words are added on purpose/)).toBeVisible();

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

    await panel.getByRole('button', { name: /^(Measure an element|Measure)/ }).click();
    await expect(panel.getByText('Click an element on the page.', { exact: false })).toBeVisible();
    const button = demo.getByRole('button', { name: 'Add to cart' }).first();
    const box = await button.boundingBox();
    if (!box) throw new Error('The demo button has no box');
    await demo.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    const card = panel.getByRole('region', { name: 'Measure' });
    await expect(card).toContainText('Add to cart');
    await expect(card).toContainText(/Fits up to \d+ characters|Still fits/);
    await expect(card).toContainText(/a translation needs about 20–22/);

    // Try other text: it shows on the page, and goes back when done. The button's name
    // changes with its text, so it's found by its place instead.
    const tried = demo.locator('article.card button.buy').first();
    const slider = card.getByRole('slider', { name: 'Length' });
    await slider.focus();
    await panel.keyboard.press('End');
    await expect(card).toContainText(
      /(Cut off|Overflows|Truncated) at \d+ characters, [\d.]+\s?px short\./,
    );
    expect((await tried.textContent())?.length).toBeGreaterThan('Add to cart'.length);
    await panel.keyboard.press('Home');
    await expect(card).toContainText('Fits at 1 character.');

    await card.getByRole('button', { name: 'Email' }).click();
    await expect.poll(() => tried.textContent()).toContain('@');
    await card.getByLabel('Your own text').fill('Zum Warenkorb hinzufügen');
    await card.getByRole('button', { name: 'Try', exact: true }).click();
    await expect.poll(() => tried.textContent()).toBe('Zum Warenkorb hinzufügen');
    await card.getByRole('button', { name: 'Put the text back' }).click();
    await expect.poll(() => tried.textContent()).toBe('Add to cart');

    // Closing the card puts tried text back too.
    await card.getByRole('button', { name: 'Name' }).click();
    await expect.poll(() => tried.textContent()).not.toBe('Add to cart');
    await card.getByRole('button', { name: 'Close measurement' }).click();
    await expect(card).toBeHidden();
    await expect.poll(() => tried.textContent()).toBe('Add to cart');
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
    await expect(panel.getByText('1 text was changed back by the page.')).toBeVisible();
    await panel.getByRole('button', { name: 'Re-apply' }).click();
    await expect(panel.getByText('1 text was changed back by the page.')).toBeHidden();
    expect(await page.locator('.tab').first().textContent()).not.toBe('Overview');
  });

  test('explains how to allow screenshots when Chrome refuses one', async ({
    openTab,
    openPanel,
  }) => {
    // Site access alone doesn't allow captures; a click on the toolbar button (activeTab) does,
    // and Playwright can't click it. The cropping itself is tested in tests/panel.
    const { page, tabId } = await openTab(`${TEST_ORIGIN}/`);
    const panel = await openPanel(tabId);
    await scan(panel);
    await rows(panel).first().click();
    await page.bringToFront();
    await panel.getByRole('button', { name: 'Copy screenshot' }).click();
    await expect(
      panel.getByText(/allows screenshots only after you click the Overflow Scout button/),
    ).toBeVisible();
    // The page was brought into view for the capture, with the result outlined.
    await expect(page.locator('overflow-scout-root .box[data-role="target"]')).toHaveCount(1);
  });

  test('treats a single-page app route change as a new page', async ({ openTab, openPanel }) => {
    const { page, tabId } = await openTab(`${TEST_ORIGIN}/`);
    const panel = await openPanel(tabId);
    const before = await pageText(page);
    await runStress(panel);
    expect(await pageText(page)).not.toBe(before);

    // The app changes route without loading: the results are stale and the page is put back.
    await page.evaluate(() => {
      history.pushState({}, '', '/settings');
    });
    await expect(
      panel.getByRole('status').filter({ hasText: 'Results are from the previous page.' }),
    ).toBeVisible();
    await expect.poll(() => pageText(page)).toBe(before);
    // Moving to an anchor, or keeping a search query in the URL, isn't a new page.
    await scan(panel);
    await expect(panel.getByText('Results are from the previous page.')).toBeHidden();
    await page.evaluate(() => {
      location.hash = 'details';
      history.replaceState({}, '', '/settings?q=invoice#details');
    });
    await page.waitForTimeout(300);
    await expect(panel.getByText('Results are from the previous page.')).toBeHidden();
    // A hash router's route change is.
    await page.evaluate(() => {
      location.hash = '#/inbox';
    });
    await expect(panel.getByText('Results are from the previous page.')).toBeVisible();
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
