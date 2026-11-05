import { describe, expect, it } from 'vitest';

import { cropRegion } from './screenshot';

describe('cropRegion', () => {
  const viewport = { width: 800, height: 600 };

  it('pads the box and scales it to the capture (device pixels and zoom)', () => {
    expect(cropRegion({ x: 100, y: 200, width: 120, height: 40 }, viewport, 1600)).toEqual({
      x: 152,
      y: 352,
      width: 336,
      height: 176,
    });
  });

  it('keeps the crop inside the window', () => {
    // A page-wide element that runs past the right edge and starts above the top.
    expect(cropRegion({ x: -10, y: -30, width: 2000, height: 50 }, viewport, 800)).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 44,
    });
  });

  it('never returns an empty region', () => {
    expect(cropRegion({ x: 900, y: 700, width: 10, height: 10 }, viewport, 800)).toMatchObject({
      width: 1,
      height: 1,
    });
  });
});
