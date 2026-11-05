import { afterAll, describe, expect, it } from 'vitest';

import { applyDeclarations, fixesFor, scanDocument, tryFixes } from '@/core';

import { loadFixture } from './harness';

const page = (body: string) => `<!doctype html><html><head><style>
  body { margin: 16px; font: 16px/20px sans-serif; }
  .nowrap { width: 120px; overflow: hidden; white-space: nowrap; }
  .fixed { width: 160px; height: 20px; overflow: hidden; transition: height 2s; }
  .cell { width: 120px; }
  .both { height: 20px; overflow: hidden; white-space: nowrap; }
</style></head><body>${body}</body></html>`;

async function trialsOf(html: string, id: string) {
  const { doc, dispose } = await loadFixture(html);
  try {
    const element = doc.getElementById(id);
    const finding = scanDocument(doc).findings.find((item) => item.element === element);
    if (!finding || !element) throw new Error(`no finding on #${id}`);
    const style = element.getAttribute('style');
    const fixes = fixesFor(finding);
    const result = tryFixes(finding, fixes);
    return {
      result,
      keys: fixes.map((fix) => fix.key),
      styleRestored: element.getAttribute('style') === style,
      stillBroken: scanDocument(doc).findings.some((item) => item.element === element),
    };
  } finally {
    dispose();
  }
}

describe('tryFixes', () => {
  it('finds the fix that makes clipped text fit, and puts the page back', async () => {
    const { result, keys, styleRestored, stillBroken } = await trialsOf(
      page('<div class="nowrap" id="t">Seasonal collections and limited editions</div>'),
      't',
    );
    expect(keys[0]).toBe('whiteSpace');
    expect(result.trials.whiteSpace?.outcome).toBe('fixes');
    // Wrapping makes the box taller, not wider.
    expect(result.trials.whiteSpace?.change.height).toBeGreaterThan(0);
    expect(result.trials.whiteSpace?.change.width).toBe(0);
    expect(styleRestored).toBe(true);
    expect(stillBroken).toBe(true);
  });

  it('measures the new size at once, even when the page animates it', async () => {
    const { result } = await trialsOf(
      page(
        '<div class="fixed" id="t">Waterproof hiking jacket with a detachable insulated hood and taped seams</div>',
      ),
      't',
    );
    expect(result.trials.height?.outcome).toBe('fixes');
  });

  it('adds the height a wrapped label needs, and tries the fixes together', async () => {
    const { result, keys, styleRestored } = await trialsOf(
      page(
        '<div class="cell"><div class="both" id="t">Waterproof hiking jacket with a detachable hood</div></div>',
      ),
      't',
    );
    expect(keys).toContain('whiteSpace');
    // Wrapping alone moves the overflow downwards: the fixed height cuts it off.
    expect(result.trials.whiteSpace?.outcome).toBe('improves');
    expect(result.trials.whiteSpace?.remaining.y).toBeGreaterThan(0);
    expect(result.added.map((fix) => [fix.key, fix.declarations])).toEqual([
      [
        'height',
        [
          ['height', 'auto'],
          ['min-height', '20px'],
        ],
      ],
    ]);
    expect(result.combined?.outcome).toBe('fixes');
    expect(styleRestored).toBe(true);
  });
});

describe('applyDeclarations', () => {
  it('leaves no empty style attribute behind when nothing read it in between', async () => {
    const { doc, dispose } = await loadFixture(page('<p id="a">a</p>'));
    try {
      const a = doc.getElementById('a');
      if (!a) throw new Error('fixture');
      applyDeclarations([{ element: a, declarations: [['width', 'auto']] }]).undo();
      expect(a.getAttribute('style')).toBeNull();
    } finally {
      dispose();
    }
  });

  it('restores the style attribute string exactly, or removes it', async () => {
    const { doc, dispose } = await loadFixture(
      page('<p id="a" style="color:red;  WIDTH: 10px">a</p><p id="b">b</p>'),
    );
    try {
      const a = doc.getElementById('a');
      const b = doc.getElementById('b');
      if (!a || !b) throw new Error('fixture');
      const edit = applyDeclarations([
        { element: a, declarations: [['width', 'auto']] },
        { element: b, declarations: [['white-space', 'normal']] },
        { element: a, declarations: [['height', 'auto']] },
      ]);
      expect(a.style.width).toBe('auto');
      expect(b.hasAttribute('style')).toBe(true);
      edit.undo();
      edit.undo();
      expect(a.getAttribute('style')).toBe('color:red;  WIDTH: 10px');
      expect(b.hasAttribute('style')).toBe(false);
    } finally {
      dispose();
    }
  });
});

afterAll(() => {
  document.body.replaceChildren();
});
