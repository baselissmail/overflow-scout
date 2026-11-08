import { readFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';
import type { browser } from 'wxt/browser';

import { OTHER_ORIGIN, TEST_ORIGIN, expect, test } from './fixtures';

type Chrome = typeof browser;

const results = (panel: Page) => panel.getByRole('listbox', { name: 'Problems' });
const rows = (panel: Page) => results(panel).getByRole('option');
const pageText = (page: Page) => page.evaluate(() => document.body.innerHTML);
const length = (panel: Page, name: 'Normal' | 'Longer' | 'Much longer' | 'Custom') =>
  panel.getByRole('radio', { name, exact: true });

/** The main button: Check page, or Check again once there are problems. */
async function scan(panel: Page): Promise<void> {
  await panel.getByRole('button', { name: /^Check (page|again)$/ }).click();
}

/** Text length: Longer makes the page's text longer and checks it. */
async function runStress(panel: Page): Promise<void> {
  await length(panel, 'Longer').click();
  await expect(length(panel, 'Longer')).toHaveAttribute('aria-checked', 'true');
  // The control is back once the page is checked with the longer text.
  await expect(length(panel, 'Longer')).toBeEnabled();
}

/** Text length: Normal puts the page's own text back. */
async function revert(panel: Page): Promise<void> {
  await length(panel, 'Normal').click();
  await expect(length(panel, 'Normal')).toHaveAttribute('aria-checked', 'true');
  await expect(length(panel, 'Normal')).toBeEnabled();
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
    for (const kind of [
      'Cut off',
      'Cut short',
      'Spills out',
      'Wider than the window',
      'Too long for its field',
    ]) {
      await expect(rows(panel).filter({ hasText: kind }).first()).toBeVisible();
    }
    await expect(panel.getByRole('heading', { name: /^\d+ problems$/ })).toBeVisible();
    await expect(panel.getByText(/^Found in \d+ texts\.$/)).toBeVisible();

    // Hovering a result outlines it on the page; clicking scrolls to it and opens details.
    await rows(panel).first().hover();
    await expect(demo.locator('overflow-scout-root .box[data-role="target"]')).toHaveCount(1);
    await rows(panel).first().click();
    await expect(demo.locator('overflow-scout-root .box[data-flash]')).toHaveCount(1);
    await expect(panel.getByText(/^(Needs|Reaches) .*\.$/)).toBeVisible();
    await panel.getByRole('button', { name: 'All problems' }).click();

    // Revealing an element below the fold scrolls the page; the pulse must survive the redraws.
    await demo.setViewportSize({ width: 800, height: 300 });
    await rows(panel).filter({ hasText: 'Ships in 2 to 3 business days' }).click();
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

    // Every view one step in leads back to the main screen the same ways: Back, or Esc.
    await expect(results(panel)).toBeHidden();
    await panel.getByRole('button', { name: 'All problems' }).click();
    await expect(rows(panel).first()).toBeVisible();
    await panel.getByRole('button', { name: 'Settings' }).click();
    await expect(results(panel)).toBeHidden();
    await panel.keyboard.press('Escape');
    await expect(rows(panel).first()).toBeVisible();
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

  test('tries other text in a result, on the page, and puts it back', async ({
    extensionId,
    openTab,
    openPanel,
  }) => {
    const { page: demo, tabId } = await openTab(`chrome-extension://${extensionId}/demo.html`);
    await demo.setViewportSize({ width: 800, height: 900 });
    const panel = await openPanel(tabId);
    const title = demo.locator('h2.title').first();
    const original = (await title.textContent())?.trim() ?? '';

    await scan(panel);
    await rows(panel).filter({ hasText: 'Waterproof hiking jacket' }).click();
    // Right there in the details, starting from the element's whole text.
    const editor = panel.getByRole('region', { name: 'Try your own text' });
    const field = editor.getByLabel('Text on the page');
    await expect(field).toHaveValue(original);

    // A shorter text fits; a longer one is cut off, by how much.
    await field.fill('Rain jacket');
    await expect.poll(() => title.textContent()).toBe('Rain jacket');
    await expect(editor).toContainText(/Fits at \d+ characters\./);
    await field.fill(
      'Waterproof hiking jacket with detachable insulated hood, taped seams and two chest pockets',
    );
    await expect(editor).toContainText(/Cut off at \d+ characters\. [\d.]+\s?px short\./);

    // Leaving the result (Esc, from anywhere in it) puts the page's own text back.
    await field.press('Escape');
    await expect.poll(async () => (await title.textContent())?.trim()).toBe(original);
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
      /^### Cut off: `section\.grid > article\.card > h2\.title` \(2 places\)\n/,
    );
    expect(report).toContain(
      `- **Page:** chrome-extension://${extensionId}/demo.html, window 800x900, Chrome `,
    );
    // Plain ASCII, like everything the panel writes.
    expect(report).toMatch(/^[\x20-\x7e\n]+$/);
    expect(report).toMatch(/- \*\*Size:\*\* Needs [\d.]+\s?px of height, has 44\s?px/);
    expect(report).toContain('- **Fixes, tried on the page:**');
    expect(report).toMatch(/`height: auto; min-height: 44px;` on `[^`]+`: Fixes it\./);

    // Files are one command away (Cmd/Ctrl+K), not another button on screen.
    await panel.keyboard.press('ControlOrMeta+k');
    await panel.keyboard.type('json');
    const [download] = await Promise.all([
      panel.waitForEvent('download'),
      panel.keyboard.press('Enter'),
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
    await panel.getByRole('button', { name: 'All problems' }).click();
    await expect(jacket).toHaveCount(0);
    await expect(rows(panel)).toHaveCount(total - 1);

    // It stays ignored across checks: the rule matches the issue's fingerprint.
    await scan(panel);
    await expect(rows(panel)).toHaveCount(total - 1);
    await panel.getByRole('button', { name: 'Show 1 ignored' }).click();
    await expect(jacket).toContainText('Ignored');
    await jacket.click();
    await panel.getByRole('button', { name: 'Stop ignoring' }).click();
    await panel.getByRole('button', { name: 'All problems' }).click();
    await expect(panel.getByRole('button', { name: /ignored/i })).toHaveCount(0);
    await expect(jacket).not.toContainText('Ignored');

    // Ignored problems are listed in Settings, by site, to undo later.
    await jacket.click();
    await panel.getByRole('button', { name: 'Ignore on this site' }).click();
    await panel.getByRole('button', { name: 'Settings' }).click();
    const group = panel.getByRole('region', { name: 'Ignored problems' });
    await expect(group).toContainText('Cut off, Demo page');
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
    await expect(rows(panel).first()).toBeVisible();
    // Problems that appear only with longer text come first, marked New.
    await expect(rows(panel).first()).toContainText('New');
    expect(await pageText(demo)).not.toBe(before);
    await expect(demo.locator('overflow-scout-root .pill')).toContainText('Longer text is on');
    // The odd-looking text is explained, with the way back.
    await expect(panel.getByText(/repeats some of its own words/)).toBeVisible();
    // The longer text is the page's own words: plain ASCII on this page, nothing added.
    expect(await demo.evaluate(() => document.body.innerText)).toMatch(/^[\x20-\x7e\s]+$/);

    // Normal puts the text back exactly, and checks the page as it is again.
    await revert(panel);
    await expect.poll(() => pageText(demo)).toBe(before);
    await expect(demo.locator('overflow-scout-root .pill')).toHaveCount(0);
    await expect(panel.getByText(/^Found in \d+ texts\.$/)).toBeVisible();
  });

  test('reverts from the button on the page', async ({ extensionId, openTab, openPanel }) => {
    const { page: demo, tabId } = await openTab(`chrome-extension://${extensionId}/demo.html`);
    const panel = await openPanel(tabId);
    const before = await pageText(demo);

    await runStress(panel);
    await demo
      .locator('overflow-scout-root .pill')
      .getByRole('button', { name: 'Back to normal' })
      .click();
    await expect(length(panel, 'Normal')).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => pageText(demo)).toBe(before);
  });

  test('inspects an element with the picker', async ({ extensionId, openTab, openPanel }) => {
    const { page: demo, tabId } = await openTab(`chrome-extension://${extensionId}/demo.html`);
    const panel = await openPanel(tabId);

    await panel.getByRole('button', { name: 'Try your own text' }).click();
    await expect(
      panel.getByText('Now click any text on the page to try your own text in it.'),
    ).toBeVisible();
    const button = demo.getByRole('button', { name: 'Add to cart' }).first();
    const box = await button.boundingBox();
    if (!box) throw new Error('The demo button has no box');
    await demo.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    const view = panel.getByRole('region', { name: 'Try your own text' });
    await expect(view).toContainText('Add to cart');
    await expect(view).toContainText(/Fits up to \d+ characters|Still fits/);
    await expect(view).toContainText(/A translation needs about 20 to 22\./);
    const field = view.getByLabel('Text on the page');
    await expect(field).toBeFocused();

    // It shows on the page, and goes back when done. The button's name changes
    // with its text, so it's found by its place instead.
    const tried = demo.locator('article.card button.buy').first();
    await view.getByRole('button', { name: 'Much longer' }).click();
    await expect(view).toContainText(
      /(Cut off|Spills out|Cut short) at \d+ characters\. [\d.]+\s?px short\./,
    );
    expect((await tried.textContent())?.length).toBeGreaterThan('Add to cart'.length);
    await view.getByRole('button', { name: 'Long link' }).click();
    await expect.poll(() => tried.textContent()).toContain('https://');
    // Your own words, live as you type.
    await field.fill('Add to basket');
    await expect.poll(() => tried.textContent()).toBe('Add to basket');
    await expect(view).toContainText(/Fits at 13 characters\./);
    await view.getByRole('button', { name: 'Longer', exact: true }).click();
    await expect(field).not.toHaveValue('Add to basket');
    await view.getByRole('button', { name: 'Put the text back' }).click();
    await expect.poll(() => tried.textContent()).toBe('Add to cart');

    // Going back puts tried text back too.
    await view.getByRole('button', { name: 'Long name' }).click();
    await expect.poll(() => tried.textContent()).not.toBe('Add to cart');
    await view.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(view).toBeHidden();
    await expect.poll(() => tried.textContent()).toBe('Add to cart');

    // Numbers count as text too: a price, like a count next to an icon.
    await panel.getByRole('button', { name: 'Try your own text' }).click();
    const price = demo.locator('article.card .price').first();
    const priceBox = await price.boundingBox();
    if (!priceBox) throw new Error('The demo price has no box');
    await demo.mouse.click(priceBox.x + priceBox.width / 2, priceBox.y + priceBox.height / 2);
    await expect(view).toContainText('$129');
    await expect(view).toContainText('Numbers stay the same in a translation.');
    await expect(field).toHaveValue('$129');
    await field.fill('$12,345.99');
    await expect.poll(() => price.textContent()).toBe('$12,345.99');
    await view.getByRole('button', { name: 'Back', exact: true }).click();
    await expect.poll(() => price.textContent()).toBe('$129');
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

  test('makes the text as long as you choose', async ({ openTab, openPanel }) => {
    const { page, tabId } = await openTab(`${TEST_ORIGIN}/`);
    const panel = await openPanel(tabId);
    const before = await pageText(page);
    const tab = page.locator('.tab').first();
    const own = (await tab.textContent()) ?? '';

    // Custom starts at twice as long, and can be changed.
    await length(panel, 'Custom').click();
    await expect(length(panel, 'Custom')).toHaveAttribute('aria-checked', 'true');
    await expect(length(panel, 'Custom')).toBeEnabled();
    const times = panel.getByRole('spinbutton', { name: 'times as long' });
    await expect(times).toHaveValue('2');
    const apply = panel.getByRole('button', { name: 'Apply', exact: true });
    await expect(apply).toBeDisabled();
    await times.fill('20');
    await expect(panel.getByText('Use a number from 1.1 to 10.')).toBeVisible();
    await expect(apply).toBeDisabled();
    await times.fill('4');
    await times.press('Enter');
    await expect(panel.getByText(/until it's 4 times as long/)).toBeVisible();
    await expect(length(panel, 'Custom')).toBeEnabled();
    const grown = (await tab.textContent()) ?? '';
    expect(grown.length).toBeGreaterThanOrEqual(own.length * 3.5);
    expect(grown.length).toBeLessThanOrEqual(own.length * 4.5);

    await revert(panel);
    await expect.poll(() => pageText(page)).toBe(before);
    // The scale is remembered for next time.
    await length(panel, 'Custom').click();
    await expect(times).toHaveValue('4');
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
    await panel.getByRole('button', { name: 'Make it longer again' }).click();
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
    const refused = panel
      .getByRole('region', { name: /^Notifications/ })
      .getByText(/allows screenshots only after you click the Overflow Scout button/);
    await expect(refused).toBeVisible();
    // Downloading needs the same capture, so it says the same.
    await panel.getByRole('button', { name: 'Download screenshot' }).click();
    await expect(refused).toHaveCount(2);
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
      panel.getByRole('status').filter({ hasText: 'These results are from the previous page.' }),
    ).toBeVisible();
    await expect.poll(() => pageText(page)).toBe(before);
    // Moving to an anchor, or keeping a search query in the URL, isn't a new page.
    await scan(panel);
    await expect(panel.getByText('These results are from the previous page.')).toBeHidden();
    await page.evaluate(() => {
      location.hash = 'details';
      history.replaceState({}, '', '/settings?q=invoice#details');
    });
    await page.waitForTimeout(300);
    await expect(panel.getByText('These results are from the previous page.')).toBeHidden();
    // A hash router's route change is.
    await page.evaluate(() => {
      location.hash = '#/inbox';
    });
    await expect(panel.getByText('These results are from the previous page.')).toBeVisible();
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
      .filter({ hasText: 'These results are from the previous page.' });
    await expect(stale).toBeVisible();

    await scan(panel);
    await expect(panel.getByText('These results are from the previous page.')).toBeHidden();
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
    await revert(panel);
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
