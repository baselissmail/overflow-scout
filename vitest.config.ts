import { fileURLToPath } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
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
        // Framework safety suites mount small React, Vue and Svelte apps.
        plugins: [svelte({ configFile: false })],
        resolve: { alias: { '@': srcDir } },
        define: {
          __VUE_OPTIONS_API__: 'false',
          __VUE_PROD_DEVTOOLS__: 'false',
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
        },
        test: {
          name: 'browser',
          // Performance budgets are looser on shared CI runners.
          provide: { ci: Boolean(process.env['CI']) },
          include: ['tests/engine/**/*.test.ts', 'tests/frameworks/**/*.test.ts'],
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
