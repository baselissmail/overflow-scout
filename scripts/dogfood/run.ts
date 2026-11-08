/**
 * Dogfooding (plan Phase 6): runs the detection engine on real sites in
 * Chromium and writes, per site, a contact sheet of every finding (a crop of
 * the page with the box outlined) plus a JSON log, for judging false
 * positives by eye. Not part of CI: it needs the network and a human.
 *
 *   pnpm dogfood            # all sites
 *   pnpm dogfood wikipedia  # sites whose name contains "wikipedia"
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';

import type * as Core from '../../src/core/index.ts';

import { SITES } from './sites.ts';

const OUT = fileURLToPath(new URL('../../.dogfood/results/', import.meta.url));
const ENGINE = readFileSync(
  fileURLToPath(new URL('../../.dogfood/engine/engine.js', import.meta.url)),
  'utf8',
);
const MAX_SHOWN = 40;

interface Logged {
  index: number;
  kind: string;
  mechanism: string;
  severity: string;
  label: string;
  text: string;
  overflow: { x: number; y: number };
  causes: string[];
  rect: { x: number; y: number; width: number; height: number };
}

async function findings(
  page: Page,
): Promise<{ logged: Logged[]; atRisk: number; textNodes: number }> {
  return page.evaluate(async (engine) => {
    // The engine bundle, injected for dogfooding only; its `var` stays local, so return it.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const load = new Function(`${engine}\nreturn overflowScout;`) as () => typeof Core;
    const scout = load();
    const scan = scout.scanDocument(document);
    const stress = await scout.runStressTest(document, {
      strategy: 'translation',
      intensity: 'realistic',
      language: 'de',
      rtl: false,
    });
    stress.session.revert();
    const kept = scan.findings;
    Object.assign(window, { dogfoodFindings: kept });
    return {
      atRisk: stress.atRisk.length,
      textNodes: scan.stats.textNodes,
      logged: kept.map((finding, index) => {
        const rect = finding.container.getBoundingClientRect();
        return {
          index,
          kind: finding.kind,
          mechanism: finding.mechanism,
          severity: finding.severity,
          label: scout.elementLabel(finding.element),
          text: finding.text.slice(0, 120),
          overflow: finding.overflow,
          causes: finding.diagnosis.causes.map((cause) => `${cause.property}: ${cause.value}`),
          rect: {
            x: rect.x + scrollX,
            y: rect.y + scrollY,
            width: rect.width,
            height: rect.height,
          },
        };
      }),
    };
  }, ENGINE);
}

/** A crop around one finding, with its box outlined. */
async function crop(page: Page, index: number): Promise<string | null> {
  const box = await page.evaluate((i) => {
    const finding = (
      window as unknown as { dogfoodFindings: { container: Element; element: Element }[] }
    ).dogfoodFindings[i];
    if (!finding) return null;
    finding.element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const rect = finding.container.getBoundingClientRect();
    document.querySelector('#dogfood-outline')?.remove();
    const outline = document.createElement('div');
    outline.id = 'dogfood-outline';
    outline.style.cssText = `position:fixed;z-index:2147483647;pointer-events:none;outline:2px solid #e5484d;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px`;
    document.documentElement.append(outline);
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, index);
  if (!box || box.width === 0 || box.height === 0) return null;
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
  const pad = 40;
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const width = Math.min(viewport.width - x, box.width + pad * 2, 900);
  const height = Math.min(viewport.height - y, box.height + pad * 2, 260);
  if (width <= 0 || height <= 0) return null;
  const image = await page.screenshot({ clip: { x, y, width, height } });
  return image.toString('base64');
}

function sheet(
  name: string,
  url: string,
  logged: Logged[],
  crops: (string | null)[],
  extra: string,
): string {
  const escape = (text: string) =>
    text.replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
    );
  const items = logged
    .slice(0, MAX_SHOWN)
    .map(
      (
        f,
        i,
      ) => `<figure><figcaption><b>#${f.index} ${f.kind}</b> (${f.mechanism}) ${escape(f.label)}<br>
      “${escape(f.text)}” · x ${f.overflow.x.toFixed(1)} y ${f.overflow.y.toFixed(1)} · ${escape(f.causes.join('; '))}</figcaption>
      ${crops[i] ? `<img src="data:image/png;base64,${crops[i]}">` : '<p>(no crop: zero-size box)</p>'}</figure>`,
    )
    .join('\n');
  return `<!doctype html><meta charset="utf-8"><style>
    body{font:12px/1.4 system-ui;margin:12px;width:940px}figure{margin:0 0 12px;border-top:1px solid #ccc;padding-top:6px}
    img{display:block;max-width:900px;border:1px solid #ddd;margin-top:4px}h1{font-size:15px}</style>
    <h1>${escape(name)} · ${escape(url)} · ${logged.length} findings ${escape(extra)}</h1>${items}`;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const filter = process.argv[2];
  const browser = await chromium.launch();
  const summary: Record<string, unknown>[] = [];
  for (const site of SITES.filter((s) => !filter || s.name.includes(filter))) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      bypassCSP: true,
      locale: 'en-US',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    try {
      await page.goto(site.url, { waitUntil: 'load', timeout: 45_000 });
      await page.waitForTimeout(2500);
      const { logged, atRisk, textNodes } = await findings(page);
      const crops: (string | null)[] = [];
      for (const f of logged.slice(0, MAX_SHOWN)) crops.push(await crop(page, f.index));
      const extra = `· ${String(textNodes)} texts · ${String(atRisk)} at risk with longer text`;
      writeFileSync(
        `${OUT}${site.name}.json`,
        JSON.stringify({ url: site.url, atRisk, textNodes, findings: logged }, null, 2),
      );
      const html = sheet(site.name, site.url, logged, crops, extra);
      const viewer = await context.newPage();
      await viewer.setContent(html);
      await viewer.screenshot({ path: `${OUT}${site.name}.png`, fullPage: true });
      summary.push({ site: site.name, textNodes, findings: logged.length, atRisk });
      process.stdout.write(
        `${site.name}: ${String(logged.length)} findings, ${String(atRisk)} at risk, ${String(textNodes)} texts\n`,
      );
    } catch (error) {
      summary.push({ site: site.name, error: String(error).slice(0, 200) });
      process.stdout.write(`${site.name}: FAILED ${String(error).slice(0, 160)}\n`);
    } finally {
      await context.close();
    }
  }
  writeFileSync(`${OUT}summary.json`, JSON.stringify(summary, null, 2));
  await browser.close();
}

await main();
