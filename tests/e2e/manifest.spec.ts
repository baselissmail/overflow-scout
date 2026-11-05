import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

/** The production build (`pnpm build`), not the e2e build the other tests load. */
const manifestPath = fileURLToPath(
  new URL('../../.output/chrome-mv3/manifest.json', import.meta.url),
);

test('the production manifest stays least-privilege', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  // Every new permission needs a plan entry and a Web Store justification (plan §2.2, §10).
  expect(manifest['permissions']).toEqual([
    'activeTab',
    'contextMenus',
    'scripting',
    'sidePanel',
    'storage',
  ]);
  expect(manifest['optional_host_permissions']).toEqual(['http://*/*', 'https://*/*']);
  expect(manifest['host_permissions']).toBeUndefined();
  expect(manifest['content_scripts']).toBeUndefined();
  expect(manifest['web_accessible_resources']).toBeUndefined();
});
