import { flatParent, isRootElement } from '../dom';
import type { LayoutReader } from './layout';

/** The visible range on one axis and the elements that set each edge. */
export interface AxisRange {
  min: number;
  max: number;
  minBy: Element | null;
  maxBy: Element | null;
}

/** Everything that limits what part of a box can be seen. */
export interface ClipContext {
  x: AxisRange;
  y: AxisRange;
  /** An ancestor contains horizontal overflow (clips or scrolls), so it can't widen the page. */
  containedX: boolean;
  /** Inside a fixed-position subtree anchored to the viewport; it never scrolls with the page. */
  viewportFixed: boolean;
}

type OverflowBehavior = 'none' | 'clip' | 'scroll';

const OPEN: AxisRange = { min: -Infinity, max: Infinity, minBy: null, maxBy: null };

export const ROOT_CONTEXT: ClipContext = {
  x: OPEN,
  y: OPEN,
  containedX: false,
  viewportFixed: false,
};

const VIEWPORT_FIXED_CONTEXT: ClipContext = { ...ROOT_CONTEXT, viewportFixed: true };

/** True when the element is a containing block for `position: fixed` descendants. */
export function establishesFixedContainingBlock(style: CSSStyleDeclaration): boolean {
  const value = (property: string) => style.getPropertyValue(property);
  return (
    value('transform') !== 'none' ||
    value('translate') !== 'none' ||
    value('rotate') !== 'none' ||
    value('scale') !== 'none' ||
    value('perspective') !== 'none' ||
    value('filter') !== 'none' ||
    (value('backdrop-filter') || 'none') !== 'none' ||
    /\b(paint|layout|strict|content)\b/.test(value('contain')) ||
    /\b(transform|perspective|filter|translate|rotate|scale)\b/.test(value('will-change')) ||
    (value('container-type') || 'normal') !== 'normal'
  );
}

function overflowBehavior(value: string, paintContained: boolean): OverflowBehavior {
  if (value === 'auto' || value === 'scroll') return 'scroll';
  if (value === 'hidden' || value === 'clip') return 'clip';
  return paintContained ? 'clip' : 'none';
}

function clipAxis(range: AxisRange, low: number, high: number, by: Element): AxisRange {
  return {
    min: low > range.min ? low : range.min,
    minBy: low > range.min ? by : range.minBy,
    max: high < range.max ? high : range.max,
    maxBy: high < range.max ? by : range.maxBy,
  };
}

/**
 * Resolves which ancestors clip a box. Follows CSS containing-block rules:
 * an absolutely positioned box is only clipped by its containing block and the
 * ancestors above it, and a fixed box escapes every ancestor unless one of them
 * establishes a containing block for it (transform, filter, contain, ...).
 */
export class ClipResolver {
  private readonly contentContexts = new Map<Element, ClipContext>();

  constructor(private readonly layout: LayoutReader) {}

  /** The clip context that applies to the element's own box. */
  forBox(element: Element): ClipContext {
    const position = this.layout.style(element).position;
    if (position === 'fixed') {
      const block = this.containingBlock(element, false);
      return block ? this.forContent(block) : VIEWPORT_FIXED_CONTEXT;
    }
    if (position === 'absolute') {
      const block = this.containingBlock(element, true);
      return block ? this.forContent(block) : ROOT_CONTEXT;
    }
    const parent = flatParent(element);
    return parent ? this.forContent(parent) : ROOT_CONTEXT;
  }

  /** The clip context that applies to content laid out inside the element. */
  forContent(element: Element): ClipContext {
    const cached = this.contentContexts.get(element);
    if (cached) return cached;

    const base = this.forBox(element);
    const context = this.applyOwnOverflow(element, base);
    this.contentContexts.set(element, context);
    return context;
  }

  reset(): void {
    this.contentContexts.clear();
  }

  /** Nearest ancestor that positions an absolute (or fixed) element. */
  containingBlock(element: Element, absolute: boolean): Element | null {
    for (let ancestor = flatParent(element); ancestor; ancestor = flatParent(ancestor)) {
      const style = this.layout.style(ancestor);
      if (absolute && style.position !== 'static') return ancestor;
      if (establishesFixedContainingBlock(style)) return ancestor;
    }
    return null;
  }

  private applyOwnOverflow(element: Element, base: ClipContext): ClipContext {
    const style = this.layout.style(element);
    if (style.display === 'contents' || isRootElement(element)) return base;

    const paintContained = /\b(paint|strict|content)\b/.test(style.getPropertyValue('contain'));
    const behaviorX = overflowBehavior(style.overflowX, paintContained);
    const behaviorY = overflowBehavior(style.overflowY, paintContained);
    if (behaviorX === 'none' && behaviorY === 'none') return base;

    const box = this.layout.paddingBox(element);
    const axis = (behavior: OverflowBehavior, range: AxisRange, low: number, high: number) => {
      if (behavior === 'clip') return clipAxis(range, low, high, element);
      // Content of a scroll container can be scrolled into view, so it isn't lost.
      if (behavior === 'scroll') return OPEN;
      return range;
    };

    return {
      x: axis(behaviorX, base.x, box.left, box.right),
      y: axis(behaviorY, base.y, box.top, box.bottom),
      containedX: base.containedX || behaviorX !== 'none',
      viewportFixed: base.viewportFixed,
    };
  }
}
