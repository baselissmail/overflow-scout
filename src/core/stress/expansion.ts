/**
 * How much longer text gets in translation, by source length.
 *
 * Source: W3C Internationalization, "Text size in translation"
 * (https://www.w3.org/International/articles/article-text-size), which quotes
 * IBM's "Guidelines to design global solutions" for English into European
 * languages. The W3C table lists totals (200–300% for up to 10 characters, and
 * so on); this table stores the extra length (+100% to +200%).
 *
 * One row is adjusted: the W3C copy prints 151–170% for 51–70 characters,
 * out of line with its neighbours (140–160% and 130%) in a table that otherwise
 * falls as text gets longer. We use 131–140%, the value usually cited from IBM.
 */

export type StressIntensity = 'realistic' | 'worst' | 'extreme';

export const STRESS_INTENSITIES = [
  'realistic',
  'worst',
  'extreme',
] as const satisfies readonly StressIntensity[];

/**
 * Limits of a custom test's scale (times as long). Past 10, text runs for
 * pages and the test says more about memory than about layout.
 */
export const SCALE_LIMITS = { min: 1.1, max: 10 } as const;

export interface ExpansionBand {
  /** Longest source text (in characters) this band applies to. */
  maxLength: number;
  /** Extra length as a fraction of the source: the low and high ends of the range. */
  low: number;
  high: number;
}

export const EXPANSION_BANDS: readonly [ExpansionBand, ...ExpansionBand[]] = [
  { maxLength: 10, low: 1, high: 2 },
  { maxLength: 20, low: 0.8, high: 1 },
  { maxLength: 30, low: 0.6, high: 0.8 },
  { maxLength: 50, low: 0.4, high: 0.6 },
  { maxLength: 70, low: 0.31, high: 0.4 },
  { maxLength: Infinity, low: 0.3, high: 0.3 },
];

/** The expansion band for text of this many characters. */
export function expansionBand(length: number): ExpansionBand {
  return EXPANSION_BANDS.find((band) => length <= band.maxLength) ?? EXPANSION_BANDS[0];
}

/**
 * Extra length as a fraction of the source. Realistic uses the low end of the
 * range, worst case the high end, and extreme doubles the worst case.
 */
export function expansionFor(length: number, intensity: StressIntensity): number {
  const { low, high } = expansionBand(length);
  switch (intensity) {
    case 'realistic':
      return low;
    case 'worst':
      return high;
    case 'extreme':
      return high * 2;
  }
}

/** Characters a translation of text this long is expected to need. */
export function translatedLength(length: number, intensity: StressIntensity): number {
  return Math.round(length * (1 + expansionFor(length, intensity)));
}
