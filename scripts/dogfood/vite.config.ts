import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

/** The detection engine as one browser script (`window.overflowScout`), for dogfooding real sites. */
export default defineConfig({
  publicDir: false,
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
  build: {
    outDir: fileURLToPath(new URL('../../.dogfood/engine', import.meta.url)),
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('../../src/core/index.ts', import.meta.url)),
      name: 'overflowScout',
      formats: ['iife'],
      fileName: () => 'engine.js',
    },
    minify: false,
  },
});
