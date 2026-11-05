import { afterAll, describe, expect, it } from 'vitest';

import { StressSession, runStressTest, translatedLength } from '@/core';

import { snapshotDom } from './dom-snapshot';
import { loadFixture, scoreFixture } from './harness';

const page = (body: string, head = '') => `<!doctype html><html><head><style>
  body { margin: 16px; font: 16px/1.4 sans-serif; }
  .clip { width: 64px; overflow: hidden; white-space: nowrap; }
</style>${head}</head><body>${body}</body></html>`;

const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

async function withPage<T>(html: string, run: (doc: Document) => Promise<T> | T): Promise<T> {
  const { doc, dispose } = await loadFixture(html);
  try {
    return await run(doc);
  } finally {
    dispose();
  }
}

const textOf = (doc: Document, selector: string) => doc.querySelector(selector)?.textContent ?? '';

describe('StressSession', () => {
  it('lengthens text in place without replacing nodes', async () => {
    await withPage(page('<h1>Settings</h1><p id="p">Save changes</p>'), async (doc) => {
      const node = doc.getElementById('p')?.firstChild;
      const session = new StressSession(doc);
      const stats = await session.apply();

      expect(doc.getElementById('p')?.firstChild).toBe(node);
      expect(textOf(doc, '#p').startsWith('Save changes ')).toBe(true);
      expect(Array.from(textOf(doc, '#p'))).toHaveLength(translatedLength(12, 'worst'));
      expect(stats).toMatchObject({ strings: 2, textNodes: 2, placeholders: 0 });
      expect(stats.growth).toBeGreaterThan(1.5);
      expect(session.active).toBe(true);
    });
  });

  it('sizes growth by the whole string, across inline markup', async () => {
    await withPage(
      page('<p id="p">You have <b>3</b> unread <em>messages</em></p>'),
      async (doc) => {
        await new StressSession(doc).apply();
        expect(textOf(doc, 'b')).toBe('3');
        expect(textOf(doc, '#p').startsWith('You have 3 unread messages')).toBe(false);
        expect(textOf(doc, '#p').replace(/\s+/g, ' ')).toHaveLength(translatedLength(26, 'worst'));
      },
    );
  });

  it('stresses placeholders and button labels, not values people typed', async () => {
    await withPage(
      page(`<input id="search" placeholder="Search"><textarea id="note" placeholder="Add a note"></textarea>
        <input id="name" value="Ada Lovelace"><input id="send" type="submit" value="Send">`),
      async (doc) => {
        const stats = await new StressSession(doc).apply();
        expect(stats).toMatchObject({ placeholders: 2, buttonValues: 1 });
        expect(doc.getElementById('search')?.getAttribute('placeholder')).toMatch(/^Search .+/);
        expect(doc.getElementById('note')?.getAttribute('placeholder')).toMatch(/^Add a note .+/);
        expect(doc.getElementById('send')?.getAttribute('value')).toMatch(/^Send .+/);
        expect((doc.getElementById('name') as HTMLInputElement).value).toBe('Ada Lovelace');
      },
    );
  });

  it('leaves code, untranslatable, editable, icon, and ignored text alone', async () => {
    const untouched = {
      code: '<code>npm test</code>',
      translate: '<span translate="no">Overflow Scout</span>',
      notranslate: '<span class="notranslate">Brand Name</span>',
      editable: '<div contenteditable="true"><p>Draft text</p></div>',
      icon: `<span style="font-family: 'Material Symbols Outlined'">search</span>`,
      script: '<script>window.label = "Hello"</script><style>.a::after { content: "x" }</style>',
      ignored: '<div id="own-ui">Extension panel</div>',
      numbers: '<span>1,024 · 12:30</span>',
    };
    await withPage(page(Object.values(untouched).join('')), async (doc) => {
      const before = snapshotDom(doc);
      const ownUi = doc.getElementById('own-ui');
      const stats = await new StressSession(doc, {
        ignore: (element) => element === ownUi,
      }).apply();
      expect(stats.textNodes).toBe(0);
      expect(snapshotDom(doc)).toBe(before);
    });
  });

  it('only stresses inside the scope', async () => {
    await withPage(
      page('<p id="outside">Outside</p><div id="scope"><p>Inside</p></div>'),
      async (doc) => {
        const scope = doc.getElementById('scope') ?? undefined;
        await new StressSession(doc, { ...(scope && { scope }) }).apply();
        expect(textOf(doc, '#outside')).toBe('Outside');
        expect(textOf(doc, '#scope').trim().startsWith('Inside ')).toBe(true);
      },
    );
  });

  it('produces the same text for the same seed', async () => {
    const html = page('<p>Download the latest invoice</p><p>Members</p>');
    const run = (seed: number) =>
      withPage(html, async (doc) => {
        await new StressSession(doc, { seed }).apply();
        return doc.body.textContent;
      });
    expect(await run(5)).toBe(await run(5));
    expect(await run(5)).not.toBe(await run(6));
  });

  it('toggles RTL on the root and restores the exact attribute', async () => {
    await withPage(page('<p>Hello</p>'), async (doc) => {
      const session = new StressSession(doc, { rtl: true });
      await session.apply();
      expect(doc.documentElement.getAttribute('dir')).toBe('rtl');
      session.revert();
      expect(doc.documentElement.hasAttribute('dir')).toBe(false);
    });
    const withDir = page('<p>Hello</p>').replace('<html>', '<html dir="LTR">');
    await withPage(withDir, async (doc) => {
      const session = new StressSession(doc, { rtl: true });
      await session.apply();
      session.revert();
      expect(doc.documentElement.getAttribute('dir')).toBe('LTR');
    });
  });

  it('reverts byte for byte', async () => {
    await withPage(
      page(`<h1>Settings</h1><p>You have <b>3</b> messages</p><input placeholder="Search">
        <input type="reset" value="Clear">`),
      async (doc) => {
        const before = snapshotDom(doc);
        const session = new StressSession(doc, { strategy: 'pseudo', rtl: true });
        await session.apply();
        expect(snapshotDom(doc)).not.toBe(before);
        const result = session.revert();
        expect(snapshotDom(doc)).toBe(before);
        expect(result).toEqual({ restored: 6, keptPageChanges: 0 });
        expect(session.active).toBe(false);
      },
    );
  });

  it('keeps text the page changed after stress, instead of restoring stale text', async () => {
    await withPage(page('<p id="count">Unread messages</p><p>Inbox</p>'), async (doc) => {
      const session = new StressSession(doc);
      await session.apply();
      const node = doc.getElementById('count')?.firstChild as Text;
      node.data = 'No unread messages';
      expect(session.pending()).toBe(1);
      expect(session.revert()).toEqual({ restored: 1, keptPageChanges: 1 });
      expect(node.data).toBe('No unread messages');
      expect(textOf(doc, 'p:last-child')).toBe('Inbox');
    });
  });

  it('re-applies stress to text the page re-rendered or added', async () => {
    await withPage(page('<ul id="list"><li id="a">Archive</li></ul>'), async (doc) => {
      const session = new StressSession(doc);
      await session.apply();
      const counts: number[] = [];
      const stop = session.watch((pending) => counts.push(pending));

      (doc.getElementById('a')?.firstChild as Text).data = 'Archived';
      const added = doc.createElement('li');
      added.textContent = 'Delete forever';
      doc.getElementById('list')?.append(added);
      // CSS-in-JS libraries add text to <style> elements; that is not page text.
      doc.head.append(Object.assign(doc.createElement('style'), { textContent: '.x{color:red}' }));
      await flush();
      expect(counts.at(-1)).toBe(2);

      await session.apply();
      expect(session.pending()).toBe(0);
      expect(textOf(doc, '#a').startsWith('Archived ')).toBe(true);
      expect(added.textContent.startsWith('Delete forever ')).toBe(true);

      session.revert();
      expect(textOf(doc, '#a')).toBe('Archived');
      expect(added.textContent).toBe('Delete forever');
      stop();
    });
  });

  it('cancels an apply that is still planning when stress is reverted', async () => {
    await withPage(page('<p>First</p><p>Second</p><p>Third</p>'), async (doc) => {
      const before = snapshotDom(doc);
      // Every pause waits on one gate, which stays open once released.
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const session = new StressSession(doc, { sliceMs: 0, yieldToHost: () => gate });
      const applying = session.apply();
      session.revert();
      release();
      await expect(applying).rejects.toThrow(/reverted before it was applied/);
      expect(snapshotDom(doc)).toBe(before);
      expect(session.active).toBe(false);
    });
  });

  it('refuses to run two passes at once', async () => {
    await withPage(page('<p>Hello</p>'), async (doc) => {
      const session = new StressSession(doc);
      const first = session.apply();
      await expect(session.apply()).rejects.toThrow(/already running/);
      await first;
    });
  });
});

const fixtures = import.meta.glob<string>('../fixtures/stress/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('runStressTest', () => {
  for (const [path, html] of Object.entries(fixtures)) {
    const name = path.replace('../fixtures/', '');
    it(`${name}: finds exactly the annotated at-risk text`, async () => {
      await withPage(html, async (doc) => {
        const result = await runStressTest(doc);
        try {
          expect(scoreFixture(doc, result.brokenNow).unexpected, 'broken now').toEqual([]);
          expect(scoreFixture(doc, result.atRisk, 'data-at-risk').unexpected, 'at risk').toEqual(
            [],
          );
        } finally {
          result.session.revert();
        }
      });
    });
  }

  it('explains at-risk findings by how the box behaved', async () => {
    await withPage(page('<div class="clip" id="label">Save</div>'), async (doc) => {
      const result = await runStressTest(doc);
      const [finding] = result.atRisk;
      result.session.revert();

      expect(finding).toMatchObject({ kind: 'hidden', growth: 3 });
      expect(finding?.diagnosis.confidence).toBe('high');
      expect(finding?.diagnosis.causes[0]).toMatchObject({ property: 'width', value: '64px' });
      expect(finding?.diagnosis.causes[0]?.note).toMatch(
        /^Width stayed 64px while the text grew 3×/,
      );
    });
  });

  it('reports timing for each phase', async () => {
    await withPage(page('<p>Hello world</p>'), async (doc) => {
      const result = await runStressTest(doc);
      result.session.revert();
      const { baseline, stress, stressed, durationMs } = result.stats;
      expect(durationMs).toBeCloseTo(
        baseline.durationMs + stress.durationMs + stressed.durationMs,
        0,
      );
      expect(stress.strings).toBe(1);
    });
  });
});

afterAll(() => {
  document.body.replaceChildren();
});
