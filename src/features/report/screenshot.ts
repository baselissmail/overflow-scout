/** A region of the captured image, in image pixels. */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where to crop a capture of the window: the finding's box with some room
 * around it, kept inside the window, in the capture's pixels (which include
 * the device pixel ratio and page zoom).
 */
export function cropRegion(
  rect: Region,
  viewport: { width: number; height: number },
  imageWidth: number,
  padding = 24,
): Region {
  const scale = imageWidth / viewport.width;
  const left = Math.max(0, rect.x - padding);
  const top = Math.max(0, rect.y - padding);
  const right = Math.min(viewport.width, rect.x + rect.width + padding);
  const bottom = Math.min(viewport.height, rect.y + rect.height + padding);
  return {
    x: Math.round(left * scale),
    y: Math.round(top * scale),
    width: Math.max(1, Math.round((right - left) * scale)),
    height: Math.max(1, Math.round((bottom - top) * scale)),
  };
}

/** Crops a PNG data URL (from `tabs.captureVisibleTab`) to a region. */
export async function cropImage(
  dataUrl: string,
  rect: Region,
  viewport: { width: number; height: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  try {
    const region = cropRegion(rect, viewport, bitmap.width);
    const canvas = new OffscreenCanvas(region.width, region.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D canvas.');
    context.drawImage(
      bitmap,
      region.x,
      region.y,
      region.width,
      region.height,
      0,
      0,
      region.width,
      region.height,
    );
    return await canvas.convertToBlob({ type: 'image/png' });
  } finally {
    bitmap.close();
  }
}
