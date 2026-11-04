import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env['CI']);

/**
 * End-to-end tests load the production build from `.output/chrome-mv3`, so
 * run `pnpm build` first (CI does). See tests/e2e/fixtures.ts.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
  },
});
