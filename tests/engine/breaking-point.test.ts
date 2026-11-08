import { afterAll, describe, expect, it } from 'vitest';

import { findBreakingPoint, resizeParts, scanDocument } from '@/core';

import { snapshotDom } from './dom-snapshot';
import { loadFixture } from './harness';

const page = (body: string) => `<!doctype html><html><head><style>
  body { margin: 16px; font: 16px/1.4 sans-serif; }
  .clip { width: 96px; overflow: hidden; white-space: nowrap; }
  .truncate { width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style></head><body>${body}</body></html>`;

async function withPage(html: string, run: (doc: Document) => void): Promise<void> {
  const { doc, dispose } = await loadFixture(html);
  try {
    run(doc);
  } finally {
    dispose();
  }
}

/** Measures whether the element's text fits at exactly `length` characters. */
function fitsAt(element: Element, length: number): boolean {
  const node = element.firstChild as Text;
  const original = node.data;
  node.data = resizeParts([original], length, 1)[0] ?? '';
  const fits = scanDocument(element.ownerDocument, { root: element }).findings.length === 0;
  node.data = original;
  return fits;
}

describe('findBreakingPoint', () => {
  it('finds the exact number of characters that fit', async () => {
    await withPage(page('<div class="clip" id="label">Save</div>'), (doc) => {
      const label = doc.getElementById('label');
      if (!label) throw new Error('missing fixture element');
      const before = snapshotDom(doc);
      const result = findBreakingPoint(label);

      expect(snapshotDom(doc)).toBe(before);
      expect(result).toMatchObject({
        length: 4,
        breaksAs: 'hidden',
        needs: { realistic: 8, worst: 12 },
      });
      const fitsUpTo = result?.fitsUpTo ?? 0;
      expect(fitsUpTo).toBeGreaterThanOrEqual(4);
      expect(fitsAt(label, fitsUpTo)).toBe(true);
      expect(fitsAt(label, fitsUpTo + 1)).toBe(false);
      expect(result?.iterations).toBeLessThanOrEqual(10);
      expect(result?.verdict).toBe(
        fitsUpTo >= 12 ? 'fits' : fitsUpTo >= 8 ? 'at-risk' : 'will-break',
      );
    });
  });

  it('reports text that already does not fit', async () => {
    await withPage(
      page('<div class="truncate" id="title">A title that is far too long</div>'),
      (doc) => {
        const title = doc.getElementById('title');
        if (!title) throw new Error('missing fixture element');
        const result = findBreakingPoint(title);
        expect(result).toMatchObject({ length: 28, verdict: 'broken', breaksAs: 'truncated' });
        const fitsUpTo = result?.fitsUpTo ?? 0;
        expect(fitsUpTo).toBeLessThan(28);
        expect(fitsAt(title, fitsUpTo)).toBe(true);
        expect(fitsAt(title, fitsUpTo + 1)).toBe(false);
        expect(title.textContent).toBe('A title that is far too long');
      },
    );
  });

  it('reports no limit for text that can grow', async () => {
    await withPage(page('<p id="p">Paragraphs wrap onto more lines.</p>'), (doc) => {
      const paragraph = doc.getElementById('p');
      if (!paragraph) throw new Error('missing fixture element');
      expect(findBreakingPoint(paragraph)).toMatchObject({ fitsUpTo: null, verdict: 'fits' });
    });
  });

  it('measures a count too: it grows by digits, and a translation keeps it as it is', async () => {
    // A like or comment count next to an icon, like the ones under an article.
    await withPage(page('<div class="clip" id="count">42</div>'), (doc) => {
      const count = doc.getElementById('count');
      if (!count) throw new Error('missing fixture element');
      const before = snapshotDom(doc);
      const result = findBreakingPoint(count);
      expect(result).toMatchObject({
        length: 2,
        translatable: false,
        needs: { realistic: 2, worst: 2 },
        verdict: 'fits',
        breaksAs: 'hidden',
      });
      const fitsUpTo = result?.fitsUpTo ?? 0;
      expect(fitsUpTo).toBeGreaterThan(2);
      expect(fitsAt(count, fitsUpTo)).toBe(true);
      expect(fitsAt(count, fitsUpTo + 1)).toBe(false);
      expect(snapshotDom(doc)).toEqual(before);
    });
  });

  it('returns null when there is no text at all', async () => {
    await withPage(page('<div id="empty"><svg width="16" height="16"></svg> </div>'), (doc) => {
      const element = doc.getElementById('empty');
      if (!element) throw new Error('missing fixture element');
      expect(findBreakingPoint(element)).toBeNull();
    });
  });
});

afterAll(() => {
  document.body.replaceChildren();
});
