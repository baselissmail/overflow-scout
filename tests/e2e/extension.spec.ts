import { expect, test } from './fixtures';

test('the side panel renders the app shell', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await expect(page.getByRole('heading', { level: 1, name: 'Overflow Scout' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});
