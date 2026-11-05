import { describe, expect, it } from 'vitest';

import { EXPANSION_BANDS, expansionBand, expansionFor, translatedLength } from './expansion';
import { createRandom, hashString, pick } from './random';

describe('expansion table', () => {
  it.each([
    [1, 1, 2],
    [10, 1, 2],
    [11, 0.8, 1],
    [20, 0.8, 1],
    [21, 0.6, 0.8],
    [30, 0.6, 0.8],
    [31, 0.4, 0.6],
    [50, 0.4, 0.6],
    [51, 0.31, 0.4],
    [70, 0.31, 0.4],
    [71, 0.3, 0.3],
    [5000, 0.3, 0.3],
  ])('uses the right band for %i characters', (length, low, high) => {
    expect(expansionBand(length)).toMatchObject({ low, high });
  });

  it('expands shorter text by more, as the source table does', () => {
    for (let index = 1; index < EXPANSION_BANDS.length; index += 1) {
      const previous = EXPANSION_BANDS[index - 1];
      const band = EXPANSION_BANDS[index];
      expect(band?.low).toBeLessThanOrEqual(previous?.low ?? 0);
      expect(band?.high).toBeLessThanOrEqual(previous?.high ?? 0);
    }
  });

  it('maps intensities to the low end, high end, and double the high end', () => {
    expect(expansionFor(12, 'realistic')).toBe(0.8);
    expect(expansionFor(12, 'worst')).toBe(1);
    expect(expansionFor(12, 'extreme')).toBe(2);
  });

  it('computes translated lengths', () => {
    // "Save changes": 12 characters needs about 22–24 (plan §4.3).
    expect(translatedLength(12, 'realistic')).toBe(22);
    expect(translatedLength(12, 'worst')).toBe(24);
    expect(translatedLength(4, 'worst')).toBe(12);
    expect(translatedLength(100, 'extreme')).toBe(160);
  });
});

describe('seeded randomness', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const first = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(first);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('differs between seeds', () => {
    expect(createRandom(1)()).not.toBe(createRandom(2)());
  });

  it('spreads picks across the list', () => {
    const random = createRandom(7);
    const items = ['a', 'b', 'c', 'd'] as const;
    const counts = new Map<string, number>();
    for (let index = 0; index < 4000; index += 1) {
      const item = pick(random, items);
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    for (const item of items) expect(counts.get(item)).toBeGreaterThan(850);
  });

  it('hashes strings stably and chains from a seed', () => {
    expect(hashString('Save changes')).toBe(hashString('Save changes'));
    expect(hashString('Save changes')).not.toBe(hashString('Save change'));
    expect(hashString('Save', 1)).not.toBe(hashString('Save', 2));
  });
});
