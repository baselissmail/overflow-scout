import { afterAll, describe, expect, it } from 'vitest';

import { findBreakingPoint, tryText } from '@/core';

import { loadFixture } from './harness';

const page = (body: string) => `<!doctype html><html><head><style>
  body { margin: 16px; font: 16px/20px sans-serif; }
  .clip { width: 120px; overflow: hidden; white-space: nowrap; }
</style></head><body>${body}</body></html>`;

describe('tryText', () => {
  it('measures a length on either side of the breaking point, and puts the text back', async () => {
    const { doc, dispose } = await loadFixture(page('<button class="clip" id="b">Save</button>'));
    try {
      const button = doc.getElementById('b');
      if (!button) throw new Error('fixture');
      const point = findBreakingPoint(button);
      const fitsUpTo = point?.fitsUpTo ?? 0;
      expect(fitsUpTo).toBeGreaterThan(4);

      const short = tryText(button, { length: fitsUpTo });
      expect(short?.trial).toMatchObject({ length: fitsUpTo, fits: true, breaksAs: null });
      short?.undo();
      const long = tryText(button, { length: fitsUpTo + 6 });
      expect(long?.trial.fits).toBe(false);
      expect(long?.trial.breaksAs).toBe('hidden');
      expect(long?.trial.overflow.x).toBeGreaterThan(0);
      // The longer text stays on the page until undone.
      expect(button.textContent.length).toBeGreaterThan(4);
      long?.undo();
      expect(button.textContent).toBe('Save');
    } finally {
      dispose();
    }
  });

  it("puts a given text in the first part and keeps the element's nodes", async () => {
    const { doc, dispose } = await loadFixture(
      page('<p class="clip" id="p">Hello <b>dear</b> friend</p>'),
    );
    try {
      const paragraph = doc.getElementById('p');
      if (!paragraph) throw new Error('fixture');
      const edit = tryText(paragraph, { text: 'María José Fernández-Villalobos de la Cruz' });
      expect(paragraph.textContent).toBe('María José Fernández-Villalobos de la Cruz');
      expect(paragraph.querySelector('b')).not.toBeNull();
      expect(edit?.trial.fits).toBe(false);
      edit?.undo();
      expect(paragraph.innerHTML).toBe('Hello <b>dear</b> friend');
    } finally {
      dispose();
    }
  });

  it('leaves text the page changed meanwhile, and skips elements without text', async () => {
    const { doc, dispose } = await loadFixture(page('<p id="p">Hello</p><p id="e"> </p>'));
    try {
      const paragraph = doc.getElementById('p');
      const empty = doc.getElementById('e');
      if (!paragraph || !empty) throw new Error('fixture');
      const edit = tryText(paragraph, { length: 30 });
      // The fixture lives in an iframe, so its Text isn't this window's Text.
      const node = paragraph.firstChild as Text | null;
      if (node) node.data = 'Rendered by the app';
      edit?.undo();
      expect(paragraph.textContent).toBe('Rendered by the app');
      expect(tryText(empty, { length: 10 })).toBeNull();
    } finally {
      dispose();
    }
  });
});

afterAll(() => {
  document.body.replaceChildren();
});
