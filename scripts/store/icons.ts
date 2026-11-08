/**
 * Renders the extension icons from store/source/*.svg (pnpm store:icons):
 * the toolbar sizes full-bleed, the 128 px icon as 96 px artwork with 16 px of
 * transparent padding, as the Chrome Web Store asks.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const root = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const large = readFileSync(root('store/source/icon.svg'), 'utf8');
const small = readFileSync(root('store/source/icon-small.svg'), 'utf8');

/** [output, canvas size, artwork size, svg] */
const ICONS: readonly [string, number, number, string][] = [
  ['public/icon/16.png', 16, 16, small],
  ['public/icon/32.png', 32, 32, large],
  ['public/icon/48.png', 48, 44, large],
  ['public/icon/128.png', 128, 96, large],
  ['store/icon-128.png', 128, 96, large],
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
mkdirSync(root('public/icon'), { recursive: true });
for (const [output, canvas, art, svg] of ICONS) {
  const pad = (canvas - art) / 2;
  await page.setViewportSize({ width: canvas, height: canvas });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">` +
      `<div style="width:${String(canvas)}px;height:${String(canvas)}px;display:grid;place-items:center">` +
      svg.replace('<svg ', `<svg width="${String(art)}" height="${String(art)}" `) +
      `</div></body></html>`,
  );
  await page.screenshot({
    path: root(output),
    omitBackground: true,
    clip: { x: 0, y: 0, width: canvas, height: canvas },
  });
  process.stdout.write(`${output} (${String(art)} px artwork, ${String(pad)} px padding)\n`);
}
await browser.close();
