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
/**
 * The only origin e2e tests run pages on (served by Playwright's request
 * routing). Playwright can't click the toolbar button that grants activeTab,
 * so the `e2e` build mode grants this one origin up front. Production builds
 * never include it; tests/e2e/manifest.spec.ts checks the production manifest.
 */
const E2E_ORIGIN = 'http://overflow-scout.test/*';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  // Explicit imports only: dependencies stay visible to readers, TypeScript and
  // the architecture-boundary lint rules.
  imports: false,
  manifest: ({ mode }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // sidePanel.onOpened (141) and sidePanel.onClosed (142) drive session cleanup.
    minimum_chrome_version: '142',
    // activeTab: the toolbar button, shortcut and context menu grant access to the current tab.
    // scripting: inject the page runtime into that tab when the user starts a scan.
    // sidePanel: the whole UI. storage: hand the latest gesture to a panel that is still opening.
    // contextMenus: "Measure this element with Overflow Scout".
    permissions: ['activeTab', 'contextMenus', 'scripting', 'sidePanel', 'storage'],
    // Requested per site, from a click in the panel ("Always allow on this site").
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    ...(mode === 'e2e' && { host_permissions: [E2E_ORIGIN] }),
    action: {
      default_title: '__MSG_actionTitle__',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+O', mac: 'Alt+Shift+O' },
      },
    },
  }),
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
