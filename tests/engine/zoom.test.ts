import { afterAll, describe, expect, it } from 'vitest';

import { scanDocument } from '@/core';

import { loadFixture } from './harness';

const page = (wrapper: string, inner: string) => `<!doctype html><html><head><style>
  body { margin: 16px; font: 16px/20px sans-serif; }
  .clip { width: 120px; overflow: hidden; white-space: nowrap; }
  .fits { width: 400px; overflow: hidden; white-space: nowrap; }
</style></head><body><div style="${wrapper}">${inner}</div></body></html>`;

const CLIPPED = '<div class="clip">Seasonal collections and limited editions</div>';
const FITS = '<div class="fits">Seasonal collections and limited</div>';

async function overflowOf(wrapper: string, inner: string): Promise<number[]> {
  const { doc, dispose } = await loadFixture(page(wrapper, inner));
  try {
    return scanDocument(doc).findings.map((finding) => finding.overflow.x);
  } finally {
    dispose();
  }
}

/**
 * Page zoom, CSS `zoom` and transforms scale what readers see. Detection must
 * not change, and amounts are in visual pixels, like the box sizes beside them.
 */
describe('zoom and transforms', () => {
  it('finds the same clipped text at any scale, in visual pixels', async () => {
    const [plain = 0] = await overflowOf('', CLIPPED);
    expect(plain).toBeGreaterThan(0);
    for (const [wrapper, scale] of [
      ['zoom: 2', 2],
      ['zoom: 0.8', 0.8],
      ['transform: scale(0.5)', 0.5],
    ] as const) {
      const [scaled = 0] = await overflowOf(wrapper, CLIPPED);
      expect(scaled / plain).toBeCloseTo(scale, 1);
    }
  });

  it('flags nothing that fits, at any scale', async () => {
    for (const wrapper of ['zoom: 2', 'zoom: 1.37', 'zoom: 0.8', 'transform: scale(0.5)']) {
      expect(await overflowOf(wrapper, FITS)).toEqual([]);
    }
  });
});

afterAll(() => {
  document.body.replaceChildren();
});
