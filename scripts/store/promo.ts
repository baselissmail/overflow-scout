/**
 * Chrome Web Store promo images (pnpm store:promo): the small tile (440×280)
 * and the marquee (1400×560). Little text, readable at half size, opaque
 * PNGs, as the store's image guidelines ask.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const root = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const font = readFileSync(
  root('node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'),
).toString('base64');

const ACCENT = '#3451d1';
const DEEP = '#22379e';
const BLEED = '#ff9592';

/** The mark: crop marks around a line that runs past its frame (store/source/icon.svg). */
const mark = (
  size: number,
) => `<svg width="${String(size)}" height="${String(size)}" viewBox="0 0 96 96">
  <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 31V20h11M54 20h11v11M17 65v11h11M54 76h11V65"/>
  </g>
  <path d="M27 48h28" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
  <path d="M65 36v24" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <path d="M73 48h7" stroke="${BLEED}" stroke-width="10" stroke-linecap="round"/>
</svg>`;

const page = (width: number, height: number, body: string) => `<!doctype html><html><head><style>
  @font-face { font-family: Geist; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
  html, body { margin: 0; }
  body { width: ${String(width)}px; height: ${String(height)}px; overflow: hidden; font-family: Geist, system-ui, sans-serif;
    color: #fff; background: radial-gradient(120% 140% at 0% 0%, ${ACCENT} 45%, ${DEEP} 100%); }
</style></head><body>${body}</body></html>`;

/**
 * The signature: a button whose translated label runs past its edge. The label
 * is drawn twice, dark inside the button and white past it, over a hatched bleed.
 */
const BUTTON = 300;
const label = (color: string, clip: string) =>
  `<span style="position:absolute;left:36px;top:50%;transform:translateY(-50%);font-size:44px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;color:${color};clip-path:${clip}">Änderungen speichern</span>`;
const cutButton = `<div style="position:relative;height:96px;width:640px">
  <div style="position:absolute;inset:0 auto 0 0;width:${String(BUTTON)}px;border-radius:16px;background:#fff;box-shadow:0 12px 40px rgb(10 16 60 / 0.35)"></div>
  <div style="position:absolute;top:18px;bottom:18px;left:${String(BUTTON)}px;width:260px;background:repeating-linear-gradient(-45deg, ${BLEED}66 0 3px, transparent 3px 10px)"></div>
  ${label('#14161b', `inset(0 calc(100% - ${String(BUTTON - 36)}px) 0 0)`)}
  ${label('#fff', `inset(0 0 0 ${String(BUTTON - 36)}px)`)}
  <div style="position:absolute;left:${String(BUTTON - 2)}px;top:-22px;bottom:-22px;width:4px;border-radius:2px;background:${BLEED}"></div>
</div>`;

const ASSETS: readonly [string, number, number, string][] = [
  [
    'store/promo-small-440x280.png',
    440,
    280,
    `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px">
      ${mark(128)}
      <div style="font-size:34px;font-weight:650;letter-spacing:-0.02em">Overflow Scout</div>
    </div>`,
  ],
  [
    'store/marquee-1400x560.png',
    1400,
    560,
    `<div style="height:100%;display:grid;grid-template-columns:520px 1fr;align-items:center;padding:0 96px;box-sizing:border-box;gap:40px">
      <div style="display:flex;flex-direction:column;gap:22px">
        ${mark(120)}
        <div style="font-size:64px;font-weight:650;letter-spacing:-0.03em;line-height:1">Overflow Scout</div>
        <div style="font-size:30px;font-weight:450;opacity:0.9;line-height:1.3">See where your text gets cut off, before your users do.</div>
      </div>
      <div style="padding:40px 0">${cutButton}</div>
    </div>`,
  ],
];

const browser = await chromium.launch();
const tab = await browser.newPage({ deviceScaleFactor: 1 });
for (const [output, width, height, body] of ASSETS) {
  await tab.setViewportSize({ width, height });
  await tab.setContent(page(width, height, body));
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: root(output), clip: { x: 0, y: 0, width, height } });
  process.stdout.write(`${output}\n`);
}
await browser.close();
