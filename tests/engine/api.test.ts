import { describe, expect, it } from 'vitest';

import { describeElement, groupFindings, scanDocument, scanDocumentAsync } from '@/core';

import { loadFixture } from './harness';

const page = (body: string) => `<!doctype html><html><head><style>
  body { margin: 16px; font: 16px/1.4 sans-serif; }
  .truncate { width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .clip { width: 120px; overflow: hidden; white-space: nowrap; }
</style></head><body>${body}</body></html>`;

describe('scanDocument', () => {
  it('reports what it measured', async () => {
    const { doc, dispose } = await loadFixture(
      page('<p>Plain text</p><div class="truncate">A title that is far too long</div><input>'),
    );
    try {
      const { findings, stats, viewport } = scanDocument(doc);
      expect(findings).toHaveLength(1);
      expect(stats).toMatchObject({ textNodes: 2, inputs: 1, slices: 1 });
      expect(viewport).toEqual({ width: 1024, height: 768 });
    } finally {
      dispose();
    }
  });

  it('describes a finding and explains its cause', async () => {
    const { doc, dispose } = await loadFixture(
      page('<div class="truncate" id="title">A title that is far too long</div>'),
    );
    try {
      const [finding] = scanDocument(doc).findings;
      expect(finding).toMatchObject({
        kind: 'truncated',
        severity: 'warning',
        mechanism: 'ellipsis',
        axes: ['x'],
        text: 'A title that is far too long',
      });
      expect(finding?.element).toBe(doc.getElementById('title'));
      expect(finding?.overflow.x).toBeGreaterThan(50);
      expect(finding?.diagnosis.confidence).toBe('high');
      expect(finding?.diagnosis.causes.map((cause) => cause.property)).toEqual(
        expect.arrayContaining(['text-overflow', 'white-space']),
      );
    } finally {
      dispose();
    }
  });

  it('skips ignored subtrees', async () => {
    const { doc, dispose } = await loadFixture(
      page('<div id="own-ui"><div class="clip">Extension UI text that is too long</div></div>'),
    );
    try {
      const ownUi = doc.getElementById('own-ui');
      const result = scanDocument(doc, { ignore: (element) => element === ownUi });
      expect(result.findings).toEqual([]);
      expect(result.stats.textNodes).toBe(0);
    } finally {
      dispose();
    }
  });

  it('scans closed shadow roots when given a way to open them', async () => {
    const { doc, dispose } = await loadFixture(page('<closed-card></closed-card>'));
    try {
      const host = doc.querySelector('closed-card');
      if (!host) throw new Error('missing host');
      const root = host.attachShadow({ mode: 'closed' });
      root.innerHTML =
        '<style>p{width:100px;overflow:hidden;white-space:nowrap}</style><p>Closed shadow text that is long</p>';

      expect(scanDocument(doc).findings).toEqual([]);
      const opened = scanDocument(doc, {
        openShadowRoot: (element) => (element === host ? root : null),
      });
      expect(opened.findings.map((finding) => finding.kind)).toEqual(['hidden']);
      expect(opened.stats.shadowRoots).toBe(1);
    } finally {
      dispose();
    }
  });

  it('counts frames it leaves out', async () => {
    const { doc, dispose } = await loadFixture(
      page('<iframe title="Embedded"></iframe><object></object><p>Text</p>'),
    );
    try {
      expect(scanDocument(doc).stats.framesSkipped).toBe(2);
    } finally {
      dispose();
    }
  });

  it('scans only inside a root element when given one', async () => {
    const { doc, dispose } = await loadFixture(
      page(
        '<div class="clip" id="outside">A label outside that is far too long</div>' +
          '<section id="scope"><div class="clip" id="inside">A label inside that is far too long</div></section>',
      ),
    );
    try {
      const scope = doc.getElementById('scope');
      const inside = doc.getElementById('inside');
      if (!scope || !inside) throw new Error('missing fixture element');
      const scoped = scanDocument(doc, { root: scope });
      expect(scoped.findings.map((finding) => finding.element)).toEqual([inside]);
      expect(scoped.stats.textNodes).toBe(1);
      // The root itself is included.
      expect(scanDocument(doc, { root: inside }).findings).toHaveLength(1);
    } finally {
      dispose();
    }
  });

  it('gives the same findings when scanning in slices', async () => {
    const rows = Array.from({ length: 200 }, (_, index) =>
      index % 3 === 0
        ? `<div class="clip">Row ${String(index)} with a label that is far too long</div>`
        : `<div>Row ${String(index)}</div>`,
    ).join('');
    const { doc, dispose } = await loadFixture(page(rows));
    try {
      const sync = scanDocument(doc);
      let pauses = 0;
      const sliced = await scanDocumentAsync(doc, {
        sliceMs: 0,
        yieldToHost: () => {
          pauses += 1;
          return Promise.resolve();
        },
      });
      expect(pauses).toBeGreaterThan(100);
      expect(sliced.findings.map((finding) => finding.element)).toEqual(
        sync.findings.map((finding) => finding.element),
      );
    } finally {
      dispose();
    }
  });
});

describe('groupFindings', () => {
  it('groups repeated components and orders by severity, then position', async () => {
    const items = Array.from(
      { length: 5 },
      (_, index) => `<li class="item truncate">List item ${String(index)} with a long label</li>`,
    ).join('');
    const { doc, dispose } = await loadFixture(
      page(
        `<ul class="list">${items}</ul><div class="clip">Hidden text that is far too long</div>`,
      ),
    );
    try {
      const issues = groupFindings(scanDocument(doc).findings);
      expect(issues.map((issue) => [issue.kind, issue.instances.length])).toEqual([
        ['hidden', 1],
        ['truncated', 5],
      ]);
    } finally {
      dispose();
    }
  });
});

describe('describeElement', () => {
  it('builds unique selectors that skip generated class names', async () => {
    const { doc, dispose } = await loadFixture(
      page(
        '<nav><a class="nav-link css-1x2y3z" href="#">One</a><a class="nav-link css-9q8w7e" href="#">Two</a></nav>',
      ),
    );
    try {
      const second = doc.querySelectorAll('a')[1];
      if (!second) throw new Error('missing link');
      const { selector, label } = describeElement(second);
      expect(doc.querySelector(selector)).toBe(second);
      expect(selector).not.toContain('css-');
      expect(label).toBe('nav › a.nav-link');
    } finally {
      dispose();
    }
  });

  it('chains through shadow roots in Playwright syntax', async () => {
    const { doc, dispose } = await loadFixture(
      page(
        '<profile-card data-testid="card"><template shadowrootmode="open"><h2 class="name">Name</h2></template></profile-card>',
      ),
    );
    try {
      const name = doc.querySelector('profile-card')?.shadowRoot?.querySelector('.name');
      if (!name) throw new Error('missing shadow content');
      expect(describeElement(name).selector).toBe('[data-testid="card"] >> .name');
    } finally {
      dispose();
    }
  });
});
