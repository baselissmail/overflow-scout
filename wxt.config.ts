import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

/**
 * Extension build configuration. The manifest is generated from this file and
 * the entrypoints in `src/entrypoints/`; see https://wxt.dev/api/config.html.
 *
 * Permissions follow least privilege: each one is added in the same change that
 * starts using it, together with its Chrome Web Store justification
 * (docs/REFACTOR_PLAN.md §2.2 and §10).
 */
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  // Explicit imports only: dependencies stay visible to readers, TypeScript and
  // the architecture-boundary lint rules.
  imports: false,
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // sidePanel.onOpened (141) and sidePanel.onClosed (142) drive session cleanup.
    minimum_chrome_version: '142',
    permissions: ['sidePanel'],
    action: {
      default_title: '__MSG_actionTitle__',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
