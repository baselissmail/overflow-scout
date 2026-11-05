import { afterAll, describe, expect, it } from 'vitest';

import { scanDocument, textCut } from '@/core';

import { loadFixture } from './harness';

const page = (body: string, dir = 'ltr') => `<!doctype html><html dir="${dir}"><head><style>
  body { margin: 16px; font: 16px/20px sans-serif; }
  .ellipsis { width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .clip { width: 120px; overflow: hidden; white-space: nowrap; }
  .lines { width: 160px; height: 40px; overflow: hidden; }
  .column { width: 140px; }
  .column span { white-space: nowrap; }
</style></head><body>${body}</body></html>`;

async function cutOf(html: string, id: string) {
  const { doc, dispose } = await loadFixture(html);
  try {
    const element = doc.getElementById(id);
    const finding = scanDocument(doc).findings.find((item) => item.element === element);
    if (!finding) throw new Error(`no finding on #${id}`);
    const text = (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return { cut: textCut(finding), text, kind: finding.kind };
  } finally {
    dispose();
  }
}

describe('textCut', () => {
  it('splits ellipsis text where the ellipsis begins', async () => {
    const { cut, text } = await cutOf(
      page('<div class="ellipsis" id="t">Seasonal collections and limited editions</div>'),
      't',
    );
    expect(cut).not.toBeNull();
    expect(`${cut?.visible ?? ''}${cut?.hidden ?? ''}`).toBe(text);
    expect(cut?.visible.length).toBeGreaterThan(4);
    expect(cut?.visible.length).toBeLessThan(text.length);
  });

  it('keeps fewer characters visible under an ellipsis than with a plain clip', async () => {
    const words = 'Seasonal collections and limited editions';
    const ellipsis = await cutOf(page(`<div class="ellipsis" id="t">${words}</div>`), 't');
    const clip = await cutOf(page(`<div class="clip" id="t">${words}</div>`), 't');
    expect(ellipsis.cut?.visible.length).toBeLessThan(clip.cut?.visible.length ?? 0);
  });

  it('finds the first hidden line of fixed-height text', async () => {
    const { cut, text } = await cutOf(
      page(
        '<div class="lines" id="t">Waterproof hiking jacket with a detachable insulated hood and taped seams</div>',
      ),
      't',
    );
    if (!cut) throw new Error('expected a cut');
    expect(cut.hidden.length).toBeGreaterThan(0);
    expect(`${cut.visible}${cut.hidden}`).toBe(text);
    // Hidden text starts on a new line, so the split falls at a word boundary.
    expect(/\s$/.test(cut.visible) || /^\s/.test(cut.hidden)).toBe(true);
  });

  it('marks the part of spilling text past its column', async () => {
    const { cut, kind } = await cutOf(
      page(
        '<div class="column"><span id="t">Ships in 2–3 business days from our warehouse</span></div>',
      ),
      't',
    );
    expect(kind).toBe('spilling');
    expect(cut?.visible.startsWith('Ships')).toBe(true);
    expect(cut?.hidden).toMatch(/warehouse$/);
  });

  it('reads right-to-left text from the right', async () => {
    const { cut, text } = await cutOf(
      page('<div class="clip" id="t">الشحن خلال يومين إلى ثلاثة أيام عمل</div>', 'rtl'),
      't',
    );
    expect(cut).not.toBeNull();
    expect(`${cut?.visible ?? ''}${cut?.hidden ?? ''}`).toBe(text);
  });

  it('returns null for inputs', async () => {
    const { cut } = await cutOf(
      page('<input id="t" style="width:60px" placeholder="Search products and orders">'),
      't',
    );
    expect(cut).toBeNull();
  });
});

afterAll(() => {
  document.body.replaceChildren();
});
