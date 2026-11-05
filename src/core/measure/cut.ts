import { walkTree } from '../collect';
import { SHOW_TEXT } from '../dom';
import type { Finding, TraversalOptions } from '../types';
import type { Bounds } from './layout';
import { LayoutReader } from './layout';

/** Where a finding's text is cut: what a reader sees, and what they lose. */
export interface TextCut {
  /** The end of the visible text (at most 80 characters, "…" in front when longer). */
  visible: string;
  /** The start of the text that is cut off or spills (at most 80 characters, "…" after). */
  hidden: string;
}

const KEEP = 80;
/** Rects may poke past an edge by subpixel amounts without losing anything. */
const SLACK = 1;

type Limits = Partial<Bounds>;

const collapse = (text: string) => text.replace(/\s+/g, ' ');

function isRtl(layout: LayoutReader, element: Element): boolean {
  return layout.style(element).direction === 'rtl';
}

/** Width of the ellipsis glyph in the element's font, which covers the last visible characters. */
function ellipsisWidth(doc: Document, style: CSSStyleDeclaration): number {
  const context = doc.createElement('canvas').getContext('2d');
  if (!context) return 0;
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText('…').width;
}

/** The edges past which the finding's text is lost or out of place. */
function limitsOf(finding: Finding, layout: LayoutReader, doc: Document): Limits | null {
  const { container, axes, mechanism } = finding;
  const rtl = isRtl(layout, container);
  const pick = (box: Bounds): Limits => ({
    ...(axes.includes('x') && (rtl ? { left: box.left } : { right: box.right })),
    ...(axes.includes('y') && { bottom: box.bottom }),
  });

  switch (mechanism) {
    case 'clip':
    case 'line-clamp':
      return pick(layout.paddingBox(container));
    case 'ellipsis': {
      const box = layout.paddingBox(container);
      const style = layout.style(container);
      const glyph = ellipsisWidth(doc, style);
      return rtl ? { left: box.left + glyph } : { right: box.right - glyph };
    }
    case 'spill':
      return pick(layout.rect(container));
    case 'page-overflow': {
      const width = doc.documentElement.clientWidth;
      return rtl ? { left: 0 } : { right: width };
    }
    case 'placeholder':
    case 'value':
      return null;
  }
}

function fits(rects: DOMRectList, limits: Limits): boolean {
  for (const rect of rects) {
    if (rect.width === 0 && rect.height === 0) continue;
    if (limits.right !== undefined && rect.right > limits.right + SLACK) return false;
    if (limits.left !== undefined && rect.left < limits.left - SLACK) return false;
    if (limits.bottom !== undefined && rect.bottom > limits.bottom + SLACK) return false;
  }
  return true;
}

/** The longest prefix of the node, in UTF-16 units, whose rendered rects stay within the limits. */
function visiblePrefix(range: Range, node: Text, limits: Limits): number {
  const { length } = node.data;
  const prefixFits = (end: number) => {
    range.setStart(node, 0);
    range.setEnd(node, end);
    return fits(range.getClientRects(), limits);
  };
  if (prefixFits(length)) return length;
  let low = 0;
  let high = length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (prefixFits(middle)) low = middle;
    else high = middle - 1;
  }
  // Never split a surrogate pair.
  const code = node.data.charCodeAt(low);
  return low > 0 && code >= 0xdc00 && code <= 0xdfff ? low - 1 : low;
}

/**
 * Splits a finding's text at the point where it is cut off, spills out of its
 * box, or runs past the viewport, by measuring rendered text rects. Returns
 * null when nothing is lost (or for inputs, whose text isn't in the DOM).
 */
export function textCut(finding: Finding, options: TraversalOptions = {}): TextCut | null {
  const doc = finding.element.ownerDocument;
  const layout = new LayoutReader(doc);
  const limits = limitsOf(finding, layout, doc);
  if (!limits) return null;

  const range = doc.createRange();
  let visible = '';
  let hidden = '';
  let cut = false;
  for (const node of walkTree(doc, finding.element, SHOW_TEXT, options)) {
    const text = node as Text;
    if (cut) {
      hidden += text.data;
      if (hidden.length > KEEP * 2) break;
      continue;
    }
    const end = visiblePrefix(range, text, limits);
    visible += text.data.slice(0, end);
    if (end < text.data.length) {
      hidden = text.data.slice(end);
      cut = true;
    }
  }

  const shown = collapse(visible).trimStart();
  const lost = collapse(hidden).trimEnd();
  if (lost.trim() === '') return null;
  return {
    visible: shown.length > KEEP ? `…${shown.slice(-KEEP)}` : shown,
    hidden: lost.length > KEEP ? `${lost.slice(0, KEEP)}…` : lost,
  };
}
