import { afterAll, describe, expect, it } from 'vitest';

import { StressSession, scanDocument } from '@/core';
import type { StressOptions } from '@/core';

import { snapshotDom } from './dom-snapshot';
import { loadFixture } from './harness';

const fixtures = import.meta.glob<string>('../fixtures/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Every strategy, with RTL and each intensity covered at least once. */
const VARIANTS: readonly StressOptions[] = [
  { strategy: 'translation', intensity: 'worst' },
  { strategy: 'pseudo', intensity: 'extreme', rtl: true },
  { strategy: 'long-words', intensity: 'realistic' },
  { strategy: 'language', language: 'ar', rtl: true },
  { strategy: 'language', language: 'th' },
];

/**
 * Plan §2.5, invariant 3: after any stress session the page DOM is identical
 * to before. Each fixture is stressed, scanned (which reads layout), and
 * reverted with every variant in turn, on the same document.
 */
describe('lossless revert', () => {
  const entries = Object.entries(fixtures).sort(([a], [b]) => a.localeCompare(b));

  for (const [path, html] of entries) {
    const name = path.replace('../fixtures/', '');
    it(name, async () => {
      const { doc, dispose } = await loadFixture(html);
      try {
        const original = snapshotDom(doc);
        for (const variant of VARIANTS) {
          const session = new StressSession(doc, variant);
          const stats = await session.apply();
          if (stats.strings > 0)
            expect(snapshotDom(doc), JSON.stringify(variant)).not.toBe(original);
          scanDocument(doc);
          const result = session.revert();
          expect(result.keptPageChanges).toBe(0);
          expect(snapshotDom(doc), JSON.stringify(variant)).toBe(original);
        }
      } finally {
        dispose();
      }
    });
  }
});

afterAll(() => {
  document.body.replaceChildren();
});
