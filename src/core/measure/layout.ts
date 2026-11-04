import { flatParent, windowOf } from '../dom';

/** A rectangle in viewport coordinates (CSS px). */
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Parses a computed CSS length such as `"12.5px"`; anything else is 0. */
export function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Expands a 1–4 value box shorthand into [top, right, bottom, left]. */
function boxSides(values: readonly string[]): [string, string, string, string] {
  const [top = '0', right = top, bottom = top, left = right] = values;
  return [top, right, bottom, left];
}

/**
 * True when `clip` or `clip-path` leaves nothing of the element visible, as in
 * visually-hidden utilities: `clip: rect(1px, 1px, 1px, 1px)`,
 * `clip-path: inset(50%)` or `inset(100%)`, `clip-path: circle(0)`.
 */
export function isClippedAway(style: CSSStyleDeclaration): boolean {
  if (style.position === 'absolute' || style.position === 'fixed') {
    // `clip` is deprecated but still common in visually-hidden utilities.
    const rect = /^rect\(([^)]*)\)$/.exec(style.getPropertyValue('clip'));
    if (rect?.[1]) {
      const [top, right, bottom, left] = boxSides(rect[1].split(/[\s,]+/).filter(Boolean));
      const numeric = (value: string) => value !== 'auto';
      if (numeric(left) && numeric(right) && px(right) - px(left) <= 1) return true;
      if (numeric(top) && numeric(bottom) && px(bottom) - px(top) <= 1) return true;
    }
  }
  const clipPath = style.clipPath;
  const inset = /^inset\(([^)]*?)(?:\s+round\b[^)]*)?\)$/.exec(clipPath);
  if (inset?.[1]) {
    const sides = boxSides(inset[1].split(/\s+/).filter(Boolean));
    if (sides.every((side) => side.endsWith('%'))) {
      const [top, right, bottom, left] = sides.map(px) as [number, number, number, number];
      if (top + bottom >= 100 || left + right >= 100) return true;
    }
  }
  return /^circle\(0(px|%)?(\s|\))/.test(clipPath);
}

/**
 * Reads computed style and geometry with per-scan caching. Caches are only
 * valid while the page doesn't change, so `reset()` runs after every pause in
 * an incremental scan.
 */
export class LayoutReader {
  readonly view: Window;
  private readonly styles = new Map<Element, CSSStyleDeclaration>();
  private readonly rects = new Map<Element, DOMRect>();
  private readonly rendered = new Map<Element, boolean>();
  private readonly clippedAway = new Map<Element, boolean>();

  constructor(doc: Document) {
    this.view = windowOf(doc);
  }

  style(element: Element): CSSStyleDeclaration {
    let style = this.styles.get(element);
    if (!style) {
      style = this.view.getComputedStyle(element);
      this.styles.set(element, style);
    }
    return style;
  }

  rect(element: Element): DOMRect {
    let rect = this.rects.get(element);
    if (!rect) {
      rect = element.getBoundingClientRect();
      this.rects.set(element, rect);
    }
    return rect;
  }

  /** The padding box, which is where overflow is clipped. */
  paddingBox(element: Element): Bounds {
    const rect = this.rect(element);
    const style = this.style(element);
    return {
      left: rect.left + px(style.borderLeftWidth),
      top: rect.top + px(style.borderTopWidth),
      right: rect.right - px(style.borderRightWidth),
      bottom: rect.bottom - px(style.borderBottomWidth),
    };
  }

  /**
   * Whether the element is painted: not display: none, visibility: hidden,
   * opacity: 0, or inside a closed `<details>`. Content skipped by
   * `content-visibility: auto` still counts, because it is shown on scroll.
   */
  isRendered(element: Element): boolean {
    const cached = this.rendered.get(element);
    if (cached !== undefined) return cached;

    let target: Element | null = element;
    let result = true;
    while (target && this.style(target).display === 'contents') {
      if (this.style(target).visibility !== 'visible') result = false;
      target = flatParent(target);
    }
    result &&=
      target?.checkVisibility({
        opacityProperty: true,
        visibilityProperty: true,
        contentVisibilityAuto: false,
      }) ?? false;
    result &&= target !== null && !this.isClippedAway(target);

    this.rendered.set(element, result);
    return result;
  }

  /** Whether the element or an ancestor is clipped to nothing (visually hidden). */
  private isClippedAway(element: Element): boolean {
    const cached = this.clippedAway.get(element);
    if (cached !== undefined) return cached;
    const parent = flatParent(element);
    const result =
      isClippedAway(this.style(element)) || (parent ? this.isClippedAway(parent) : false);
    this.clippedAway.set(element, result);
    return result;
  }

  reset(): void {
    this.styles.clear();
    this.rects.clear();
    this.rendered.clear();
    this.clippedAway.clear();
  }
}
