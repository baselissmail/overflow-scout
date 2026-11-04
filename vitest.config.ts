import { fileURLToPath } from 'node:url';

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        // Pure logic: fast, runs in Node with WXT's aliases and fake browser APIs.
        plugins: [WxtVitest()],
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'node',
        },
      },
      {
        // Layout-dependent engine tests need a real browser (jsdom has no layout).
        resolve: { alias: { '@': srcDir } },
        test: {
          name: 'browser',
          include: ['tests/engine/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
