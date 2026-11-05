import type { ClipContext } from './clip';
import type { Bounds } from './layout';

/** The rendered geometry of one text node, one fragment per line box. */
export interface TextGeometry {
  fragments: Bounds[];
  bounds: Bounds;
}

/** How much of a text is cut off by its clip context, per side. */
export interface ClipOverflow {
  x: number;
  y: number;
  /** The element that hides the most content on each axis. */
  xBy: Element | null;
  yBy: Element | null;
  /** Fraction of the text's area that is still visible (0–1). */
  visibleFraction: number;
}

/**
 * Measures a text node, trimmed of leading and trailing whitespace so that
 * preserved spaces don't count as overflowing content.
 */
export function measureText(range: Range, node: Text): TextGeometry | null {
  const data = node.data;
  const start = data.search(/\S/);
  if (start < 0) return null;
  const end = data.trimEnd().length;

  range.setStart(node, start);
  range.setEnd(node, end);

  const fragments: Bounds[] = [];
  for (const rect of range.getClientRects()) {
    if (rect.width > 0 && rect.height > 0) {
      fragments.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    }
  }
  const [first, ...rest] = fragments;
  if (!first) return null;

  const bounds = { ...first };
  for (const fragment of rest) {
    bounds.left = Math.min(bounds.left, fragment.left);
    bounds.top = Math.min(bounds.top, fragment.top);
    bounds.right = Math.max(bounds.right, fragment.right);
    bounds.bottom = Math.max(bounds.bottom, fragment.bottom);
  }
  return { fragments, bounds };
}

function overlap(low: number, high: number, min: number, max: number): number {
  return Math.max(0, Math.min(high, max) - Math.max(low, min));
}

/** Compares text geometry with its clip context. Returns null when nothing is cut off. */
export function clipOverflow(geometry: TextGeometry, context: ClipContext): ClipOverflow | null {
  const { x, y } = context;
  let totalArea = 0;
  let visibleArea = 0;
  for (const fragment of geometry.fragments) {
    const width = fragment.right - fragment.left;
    const height = fragment.bottom - fragment.top;
    totalArea += width * height;
    visibleArea +=
      overlap(fragment.left, fragment.right, x.min, x.max) *
      overlap(fragment.top, fragment.bottom, y.min, y.max);
  }

  const { bounds } = geometry;
  const left = Math.max(0, x.min - bounds.left);
  const right = Math.max(0, bounds.right - x.max);
  const top = Math.max(0, y.min - bounds.top);
  const bottom = Math.max(0, bounds.bottom - y.max);
  if (left + right + top + bottom === 0) return null;

  return {
    x: Math.max(left, right),
    y: Math.max(top, bottom),
    xBy: right >= left ? x.maxBy : x.minBy,
    yBy: bottom >= top ? y.maxBy : y.minBy,
    visibleFraction: totalArea > 0 ? visibleArea / totalArea : 0,
  };
}
