import { walkTree } from '../collect';
import { SHOW_TEXT } from '../dom';
import type { Finding, TraversalOptions } from '../types';
import type { Bounds } from './layout';
import { LayoutReader } from './layout';

/** Where a finding's text is cut: what a reader sees, and what they lose. */
export interface TextCut {
  /** The end of the visible text (about 80 characters, from a word start, "…" in front when longer). */
  visible: string;
  /** The start of the text that is cut off or spills (about 80 characters, to a word end, "…" after). */
  hidden: string;
}

const KEEP = 80;
/** Up to this many characters are given up so the context starts or ends on a whole word. */
const WORD_SLACK = 20;
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

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * The last KEEP characters of the visible text, starting on a whole word when one
 * starts close by. Scripts without spaces fall back to a character cut.
 */
function lastPart(text: string): string {
  if (text.length <= KEEP) return text;
  let start = text.length - KEEP;
  if (text[start - 1] !== ' ') {
    const space = text.indexOf(' ', start);
    if (space !== -1 && space - start < WORD_SLACK) start = space + 1;
    else if (isLowSurrogate(text.charCodeAt(start))) start += 1;
  }
  return `…${text.slice(start)}`;
}

/** The first KEEP characters of the lost text, ending on a whole word when one ends close by. */
function firstPart(text: string): string {
  if (text.length <= KEEP) return text;
  let end = KEEP;
  if (text[end] !== ' ') {
    const space = text.lastIndexOf(' ', end);
    if (space > 0 && end - space < WORD_SLACK) end = space;
    else if (isLowSurrogate(text.charCodeAt(end))) end -= 1;
  }
  return `${text.slice(0, end)}…`;
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
  return low > 0 && isLowSurrogate(node.data.charCodeAt(low)) ? low - 1 : low;
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
  // The split itself stays exact; only the outer ends are shortened.
  return { visible: lastPart(shown), hidden: firstPart(lost) };
}
