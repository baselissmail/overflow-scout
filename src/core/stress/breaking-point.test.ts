import { describe, expect, it } from 'vitest';

import { verdictFor } from './breaking-point';

describe('verdictFor', () => {
  // "Save changes" (12 characters) needs about 22 (realistic) to 24 (worst case).
  const needs = { realistic: 22, worst: 24 };

  it.each([
    [null, 'fits'],
    [40, 'fits'],
    [24, 'fits'],
    [23, 'at-risk'],
    [22, 'at-risk'],
    [21, 'will-break'],
    [12, 'will-break'],
  ] as const)('room for %s characters → %s', (fitsUpTo, verdict) => {
    expect(verdictFor(fitsUpTo, needs)).toBe(verdict);
  });
});
