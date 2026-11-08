import { describe, expect, it, vi } from 'vitest';

import type { FindingDto, IssueDto } from '@/messaging/protocol';

import { browserName, exportFileName, resultsJson } from './json';
import type { ReportContext } from './markdown';
import { code, escapeText, issueMarkdown, resultsMarkdown } from './markdown';

// The fake browser has no i18n; keys and substitutions are enough to check the structure.
vi.mock('#i18n', () => ({
  i18n: {
    t: (key: string, a?: unknown, b?: unknown) => {
      const subs = Array.isArray(a) ? a : Array.isArray(b) ? b : [];
      return subs.length > 0 ? `${key}(${subs.join(', ')})` : key;
    },
  },
}));

function finding(overrides: Partial<FindingDto> = {}): FindingDto {
  return {
    id: 'f1',
    kind: 'hidden',
    severity: 'critical',
    mechanism: 'clip',
    axes: ['y'],
    overflow: { x: 0, y: 20 },
    text: 'Waterproof *hiking* jacket',
    element: { label: 'article.card > h2.title', selector: '.card > h2' },
    container: { label: 'article.card > h2.title' },
    diagnosis: {
      confidence: 'high',
      causes: [
        {
          element: { label: 'h2.title' },
          property: 'height',
          value: '44px',
          note: 'height stays 44px',
        },
      ],
    },
    box: { width: 200, height: 44 },
    cut: { visible: 'Waterproof hiking', hidden: 'jacket' },
    ...overrides,
  };
}

const issue = (instances: FindingDto[]): IssueDto => ({
  id: 'hidden|h2.title|article.card',
  order: 0,
  kind: 'hidden',
  severity: 'critical',
  instances,
});

const context: ReportContext = {
  url: 'https://shop.example/products',
  viewport: { width: 800, height: 900 },
  browser: 'Chrome 156',
  stress: null,
};

describe('Markdown helpers', () => {
  it('escapes characters that would format the text', () => {
    expect(escapeText('a *b* _c_ [d](e) <f> |g| ~h~ `i`')).toBe(
      'a \\*b\\* \\_c\\_ \\[d\\](e) \\<f\\> \\|g\\| \\~h\\~ \\`i\\`',
    );
  });

  it('keeps code spans intact with backticks and line breaks inside', () => {
    expect(code('height: auto;\nmin-height: 44px;')).toBe('`height: auto; min-height: 44px;`');
    expect(code('a`b')).toBe('``a`b``');
    expect(code('`a')).toBe('`` `a ``');
  });
});

describe('issueMarkdown', () => {
  it('says what goes wrong, where, by how much, why, and what fixed it', () => {
    const markdown = issueMarkdown(
      issue([finding(), finding({ id: 'f2' })]),
      {
        finding: finding(),
        cut: { visible: 'Waterproof hiking', hidden: 'jacket' },
        selector: '.card > h2',
        fixes: {
          trials: [
            {
              key: 'height',
              trial: {
                outcome: 'fixes',
                remaining: { x: 0, y: 0 },
                change: { width: 0, height: 22 },
              },
            },
          ],
          added: [],
          combined: null,
        },
      },
      context,
    );
    const lines = markdown.split('\n');
    expect(lines[0]).toBe('### kind.hidden: `article.card > h2.title` (results.places(2))');
    expect(markdown).toContain(
      '- **report.page:** https://shop.example/products, report.window(800x900), Chrome 156',
    );
    // Page text is escaped; it can't turn into emphasis or links.
    expect(markdown).toContain('"Waterproof \\*hiking\\* jacket"');
    expect(markdown).toContain('report.cutLost("Waterproof hiking", "jacket")');
    expect(markdown).toContain('- **detail.selector:** `.card > h2`');
    expect(markdown).toContain('  - `height: 44px` report.on `h2.title`: height stays 44px');
    expect(markdown).toContain('- **report.fixesTried:**');
    expect(markdown).toContain(
      '  - `height: auto; min-height: 44px;` report.on `h2.title`: fix.fixes fix.sizeOne(fix.taller(22 px))',
    );
  });

  it('lists fixes as suggestions when they were not tried', () => {
    const markdown = issueMarkdown(
      issue([finding()]),
      { finding: finding(), cut: null, selector: null, fixes: null },
      context,
    );
    expect(markdown).toContain('- **report.fixesSuggested:**');
    expect(markdown).not.toContain('fix.fixes');
    expect(markdown).not.toContain('(results.places');
  });
});

describe('resultsMarkdown', () => {
  it('states the test once and splits stress results into new and already broken', () => {
    const markdown = resultsMarkdown(
      { atRisk: [issue([finding({ before: 'Jacket' })])], brokenNow: [] },
      {
        ...context,
        stress: {
          options: { strategy: 'translation', intensity: 'realistic', language: 'de', rtl: false },
          growth: 1.4,
        },
      },
    );
    expect(markdown.match(/report\.page/g)).toHaveLength(1);
    expect(markdown).toContain('report.test(length.realistic, 1.4)');
    expect(markdown).toContain('### results.atRisk (1)');
    expect(markdown).toContain('#### kind.hidden');
    expect(markdown).toContain('- **detail.before:** "Jacket"');
    expect(markdown).toContain('### results.brokenNow (0)\n\nresults.noneNow');
  });

  it('names a custom length as one', () => {
    const markdown = resultsMarkdown(
      { atRisk: [], brokenNow: [] },
      {
        ...context,
        stress: {
          options: {
            strategy: 'translation',
            intensity: 'worst',
            language: 'de',
            rtl: false,
            scale: 3,
          },
          growth: 2.9,
        },
      },
    );
    expect(markdown).toContain('report.test(length.custom, 2.9)');
  });
});

describe('export helpers', () => {
  it('names files after the site and the time', () => {
    const at = new Date(2026, 10, 5, 9, 7);
    expect(exportFileName('https://shop.example/a?b', at, 'json')).toBe(
      'overflow-scout-shop.example-2026-11-05-0907.json',
    );
    expect(exportFileName('about:blank', at, 'md')).toBe('overflow-scout-page-2026-11-05-0907.md');
  });

  it('reads the browser from the user agent', () => {
    expect(browserName('Mozilla/5.0 … Chrome/156.0.0.0 Safari/537.36')).toBe('Chrome 156');
    expect(browserName('… Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0')).toBe('Edge 156');
    expect(browserName('Firefox/150')).toBeNull();
  });

  it('exports scan results as versioned data', () => {
    const data = JSON.parse(
      resultsJson({
        version: '1.0.0',
        createdAt: new Date('2026-11-05T10:00:00Z'),
        title: 'Shop',
        context,
        results: {
          issues: [issue([finding()])],
          viewport: context.viewport,
          stats: {
            textNodes: 26,
            inputs: 1,
            skippedInvisible: 0,
            skippedForeign: 0,
            shadowRoots: 0,
            framesSkipped: 0,
            durationMs: 2,
            wallMs: 2,
            slices: 1,
            longestSliceMs: 2,
          },
        },
      }),
    ) as Record<string, unknown>;
    expect(data).toMatchObject({
      format: 'overflow-scout/results',
      formatVersion: 1,
      tool: { name: 'Overflow Scout', version: '1.0.0' },
      createdAt: '2026-11-05T10:00:00.000Z',
      page: { url: 'https://shop.example/products', title: 'Shop' },
      test: null,
    });
    expect(data['issues']).toHaveLength(1);
  });
});
