import { describe, expect, it } from 'vitest';

import { cropImage } from '@/features/report/screenshot';

/** A capture of an 800×600 window at 2× pixels: white, with a red element at (100, 200). */
async function capture(): Promise<string> {
  const canvas = new OffscreenCanvas(1600, 1200);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D canvas');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 1600, 1200);
  context.fillStyle = '#ff0000';
  context.fillRect(200, 400, 240, 80);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(blob);
  });
}

describe('cropImage', () => {
  it('crops a capture to the element with room around it, at the capture’s scale', async () => {
    const blob = await cropImage(
      await capture(),
      { x: 100, y: 200, width: 120, height: 40 },
      { width: 800, height: 600 },
    );
    expect(blob.type).toBe('image/png');
    const bitmap = await createImageBitmap(blob);
    // 24 px of room on each side, doubled for the 2× capture.
    expect([bitmap.width, bitmap.height]).toEqual([336, 176]);

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D canvas');
    context.drawImage(bitmap, 0, 0);
    const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data];
    // The element starts 48 image pixels in; the margin around it is the page.
    expect(pixel(10, 10)).toEqual([255, 255, 255, 255]);
    expect(pixel(60, 60)).toEqual([255, 0, 0, 255]);
  });
});
