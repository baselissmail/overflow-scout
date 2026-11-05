import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * WCAG 2.2 contrast for the design tokens in styles.css: 4.5:1 for text
 * (1.4.3), 3:1 for control borders and focus rings (1.4.11).
 */
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

function tokensIn(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block in styles.css`);
  const block = css.slice(start, css.indexOf('}', start));
  return new Map(
    Array.from(block.matchAll(/--os-([\w-]+):\s*(#[0-9a-f]{6})/gi), (match) => [
      match[1] ?? '',
      (match[2] ?? '').toLowerCase(),
    ]),
  );
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const THEMES = {
  light: tokensIn(':root'),
  dark: tokensIn(":root[data-theme='dark']"),
};

/** [foreground, background, minimum ratio] */
const PAIRS: readonly [string, string, number][] = [
  ['fg', 'canvas', 4.5],
  ['fg', 'raised', 4.5],
  ['fg', 'surface', 4.5],
  ['fg-muted', 'raised', 4.5],
  ['fg-muted', 'canvas', 4.5],
  ['fg-muted', 'surface', 4.5],
  ['accent', 'canvas', 4.5],
  ['accent', 'raised', 4.5],
  ['critical', 'raised', 4.5],
  ['warning', 'raised', 4.5],
  ['notice', 'raised', 4.5],
  ['ok', 'raised', 4.5],
  ['line-strong', 'raised', 3],
  ['accent', 'accent-soft', 4.5],
  ['accent-fg', 'accent', 4.5],
  ['critical', 'canvas', 4.5],
  ['critical', 'critical-soft', 4.5],
  ['warning', 'canvas', 4.5],
  ['warning', 'warning-soft', 4.5],
  ['notice', 'canvas', 4.5],
  ['notice', 'notice-soft', 4.5],
  ['ok', 'canvas', 4.5],
  ['ok', 'ok-soft', 4.5],
  ['fg', 'warning-soft', 4.5],
  ['fg', 'critical-soft', 4.5],
  ['line-strong', 'canvas', 3],
  ['accent', 'surface', 3],
];

describe('design tokens', () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    for (const [foreground, background, minimum] of PAIRS) {
      it(`${theme}: ${foreground} on ${background} ≥ ${String(minimum)}:1`, () => {
        const fg = tokens.get(foreground);
        const bg = tokens.get(background);
        expect(fg, foreground).toBeDefined();
        expect(bg, background).toBeDefined();
        expect(contrast(fg ?? '', bg ?? '')).toBeGreaterThanOrEqual(minimum);
      });
    }
  }

  it('defines the same roles in both themes', () => {
    expect([...THEMES.dark.keys()].sort()).toEqual([...THEMES.light.keys()].sort());
  });

  it('keeps the two dark blocks identical', () => {
    const media = tokensIn(":root:not([data-theme='light'])");
    expect(Object.fromEntries(media)).toEqual(Object.fromEntries(THEMES.dark));
  });
});
