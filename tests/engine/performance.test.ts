import { describe, expect, inject, it } from 'vitest';

import { scanDocumentAsync } from '@/core';

import { loadFixture } from './harness';

/** Budgets from docs/REFACTOR_PLAN.md §3.7. CI runners are slower and noisier. */
const SCALE = inject('ci') ? 3 : 1;
const BUDGET_MS = 300 * SCALE;
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
});
