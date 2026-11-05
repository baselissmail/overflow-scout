import { describe, expect, inject, it } from 'vitest';

import { runStressTest, scanDocumentAsync } from '@/core';

import { loadFixture } from './harness';

/** Budgets from docs/REFACTOR_PLAN.md §3.7. CI runners are slower and noisier. */
const SCALE = inject('ci') ? 3 : 1;
const BUDGET_MS = 300 * SCALE;
const STRESS_BUDGET_MS = 500 * SCALE;
const LONG_TASK_MS = 50;

/** 1,250 cards × 4 text nodes = 5,000 text nodes; every fourth title overflows. */
function syntheticPage(cards: number): string {
  const items: string[] = [];
  for (let index = 0; index < cards; index += 1) {
    const title =
      index % 4 === 0
        ? `Quarterly infrastructure report for region ${String(index)}`
        : `Report ${String(index)}`;
    items.push(
      `<article class="card"><h3 class="title">${title}</h3>` +
        `<p>Short description for card ${String(index)} that wraps freely.</p>` +
        `<button>Open</button><span class="meta">Updated today</span></article>`,
    );
  }
  return `<!doctype html><html><head><style>
    body { margin: 16px; font: 14px/1.4 sans-serif; }
    .grid { display: grid; grid-template-columns: repeat(4, 220px); gap: 12px; }
    .card { border: 1px solid #ddd; padding: 8px; }
    .title { width: 180px; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
  </style></head><body><main class="grid">${items.join('')}</main></body></html>`;
}

describe('scan performance', () => {
  it('scans 5,000 text nodes within budget and without long tasks', async () => {
    const { doc, dispose } = await loadFixture(syntheticPage(1250));
    try {
      const result = await scanDocumentAsync(doc);
      const { stats } = result;
      console.info(
        `Scanned ${String(stats.textNodes)} text nodes: ${String(stats.durationMs)} ms of work ` +
          `in ${String(stats.slices)} slices (longest ${String(stats.longestSliceMs)} ms), ` +
          `${String(stats.wallMs)} ms wall clock, ${String(result.findings.length)} findings`,
      );

      expect(stats.textNodes).toBeGreaterThanOrEqual(5000);
      expect(result.findings.filter((finding) => finding.kind === 'truncated')).toHaveLength(313);
      expect(stats.durationMs).toBeLessThanOrEqual(BUDGET_MS);
      expect(stats.longestSliceMs).toBeLessThan(LONG_TASK_MS);
    } finally {
      dispose();
    }
  });

  it('stress-tests 5,000 text nodes within budget and without long tasks', async () => {
    const { doc, dispose } = await loadFixture(syntheticPage(1250));
    try {
      const result = await runStressTest(doc);
      const { stress, stressed, durationMs, longestSliceMs } = result.stats;
      const revertStart = performance.now();
      result.session.revert();
      const revertMs = performance.now() - revertStart;
      console.info(
        `Stress test: ${String(durationMs)} ms of work (stress ${String(stress.durationMs)} ms, ` +
          `stressed scan ${String(stressed.durationMs)} ms), longest slice ${String(longestSliceMs)} ms ` +
          `(stress ${String(stress.longestSliceMs)} ms, stressed scan ${String(stressed.longestSliceMs)} ms), ` +
          `${String(stress.strings)} strings, ${String(result.atRisk.length)} at risk, ` +
          `revert ${revertMs.toFixed(1)} ms`,
      );

      expect(stress.textNodes).toBeGreaterThanOrEqual(3750);
      // Short titles fit now; at worst-case length many are cut off too. Nothing
      // else on the page is at risk: descriptions wrap and buttons grow.
      expect(result.atRisk.length).toBeGreaterThan(0);
      for (const finding of result.atRisk) {
        expect(finding.kind).toBe('truncated');
        expect(finding.element.className).toBe('title');
      }
      expect(durationMs).toBeLessThanOrEqual(STRESS_BUDGET_MS);
      // Planning and the single write commit never block the page.
      expect(stress.longestSliceMs).toBeLessThan(LONG_TASK_MS);
      expect(revertMs).toBeLessThan(LONG_TASK_MS);
      // The stressed scan's first read makes the browser lay out every changed
      // string at once: the same work it does to paint the stressed page.
      expect(stressed.longestSliceMs).toBeLessThan(LONG_TASK_MS * SCALE);
    } finally {
      dispose();
    }
  });
});
