import { afterAll, describe, expect, it } from 'vitest';

import { scanDocument } from '@/core';

import { loadFixture, scoreFixture } from './harness';

const fixtures = import.meta.glob<string>('../fixtures/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Quality gates from docs/REFACTOR_PLAN.md §7. */
const MIN_PRECISION = 0.95;
const MIN_RECALL = 0.95;

const totals = { truePositives: 0, falsePositives: 0, falseNegatives: 0, knownGoodFindings: 0 };
const limitations: string[] = [];

describe('detection corpus', () => {
  const entries = Object.entries(fixtures).sort(([a], [b]) => a.localeCompare(b));

  it('has fixtures', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [path, html] of entries) {
    const name = path.replace('../fixtures/', '');
    it(name, async () => {
      const { doc, dispose } = await loadFixture(html);
      try {
        const result = scanDocument(doc);
        const score = scoreFixture(doc, result.findings);
        totals.truePositives += score.truePositives;
        totals.falsePositives += score.falsePositives;
        totals.falseNegatives += score.falseNegatives;
        if (name.startsWith('known-good/')) totals.knownGoodFindings += result.findings.length;
        limitations.push(...score.limitations.map((entry) => `${name}: ${entry}`));
        expect(score.unexpected, `${name} does not match its annotations`).toEqual([]);
      } finally {
        dispose();
      }
    });
  }

  it('meets the precision and recall gates', () => {
    const { truePositives, falsePositives, falseNegatives } = totals;
    const precision = truePositives / (truePositives + falsePositives || 1);
    const recall = truePositives / (truePositives + falseNegatives || 1);
    console.info(
      [
        `Corpus: ${String(entries.length)} fixtures, ${String(truePositives + falseNegatives)} expected findings`,
        `Precision ${(precision * 100).toFixed(1)}% · Recall ${(recall * 100).toFixed(1)}%`,
        `TP ${String(truePositives)} · FP ${String(falsePositives)} · FN ${String(falseNegatives)}`,
        ...limitations.map((entry) => `  limitation → ${entry}`),
      ].join('\n'),
    );
    expect(totals.knownGoodFindings, 'known-good fixtures must produce no findings').toBe(0);
    expect(precision).toBeGreaterThanOrEqual(MIN_PRECISION);
    expect(recall).toBeGreaterThanOrEqual(MIN_RECALL);
  });
});

afterAll(() => {
  document.body.replaceChildren();
});
