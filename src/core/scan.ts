import { walkTree } from './collect';
import { diagnose } from './diagnose/diagnose';
import {
  SHOW_ELEMENT,
  SHOW_TEXT,
  TEXT_NODE,
  flatParent,
  isHtmlElement,
  isInput,
  isRootElement,
  sampleText,
} from './dom';
import { ClipResolver } from './measure/clip';
import type { Bounds } from './measure/layout';
import { LayoutReader, px } from './measure/layout';
import { clipOverflow, measureText } from './measure/text';
import { runInSlices, runToEnd } from './schedule';
import type {
  Axis,
  Finding,
  FindingKind,
  Mechanism,
  ScanOptions,
  ScanResult,
  ScanStats,
  SliceTiming,
} from './types';
import { SEVERITY_BY_KIND } from './types';

/** Overflow along the line direction below this many CSS px is rounding noise. */
const LINE_TOLERANCE = 1;
/** Canvas and layout text widths differ slightly. */
const PLACEHOLDER_TOLERANCE = 2;
/** Clip boxes smaller than this hide text on purpose (visually-hidden patterns). */
const TINY_BOX = 2;
/**
 * Across lines, overflow must exceed a quarter of the font size: line boxes
 * with a tight line-height routinely overflow by a few pixels of empty
 * ascender or descender space without hiding anything readable.
 */
const crossTolerance = (fontSize: number) => Math.max(2, fontSize * 0.25);

/** Minimum overflow per axis. Vertical writing modes stack lines horizontally. */
interface Tolerance {
  x: number;
  y: number;
}

function toleranceFor(style: CSSStyleDeclaration): Tolerance {
  const across = crossTolerance(px(style.fontSize));
  const vertical = /^(vertical|sideways)/.test(style.writingMode);
  return vertical ? { x: across, y: LINE_TOLERANCE } : { x: LINE_TOLERANCE, y: across };
}

/** Internal table boxes: cells may legitimately extend past them (rowspan, colspan). */
const INTERNAL_TABLE_DISPLAYS = new Set([
  'table-row',
  'table-row-group',
  'table-header-group',
  'table-footer-group',
  'table-column',
  'table-column-group',
]);
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

/** When one element has several text problems, report the most serious one. */
const TEXT_KIND_PRECEDENCE: readonly FindingKind[] = ['hidden', 'truncated', 'spilling'];

type Target = { type: 'text'; node: Text } | { type: 'input'; element: HTMLInputElement };

interface Draft {
  kind: FindingKind;
  mechanism: Mechanism;
  element: Element;
  container: Element;
  overflow: { x: number; y: number };
  text: string;
  /** Text bounds, kept for spilling text so page overflow can be traced to it. */
  bounds: Bounds | null;
}

function lineClamp(style: CSSStyleDeclaration): string | null {
  const value =
    style.getPropertyValue('-webkit-line-clamp') || style.getPropertyValue('line-clamp');
  return value && value !== 'none' ? value : null;
}

function union(a: Bounds, b: Bounds): Bounds {
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

const round = (value: number) => Math.round(value * 10) / 10;

type Counts = Omit<ScanStats, keyof SliceTiming>;

class ScanSession {
  readonly counts: Counts = {
    textNodes: 0,
    inputs: 0,
    skippedInvisible: 0,
    skippedForeign: 0,
    shadowRoots: 0,
    framesSkipped: 0,
  };
  readonly findings: Finding[] = [];

  private readonly layout: LayoutReader;
  private readonly clips: ClipResolver;
  private readonly range: Range;
  private readonly drafts = new Map<Element, Map<FindingKind, Draft>>();
  private canvas: CanvasRenderingContext2D | null | undefined;

  constructor(
    private readonly doc: Document,
    private readonly options: ScanOptions,
  ) {
    this.layout = new LayoutReader(doc);
    this.clips = new ClipResolver(this.layout);
    this.range = doc.createRange();
  }

  /** The whole scan as small steps; drivers decide when to pause between them. */
  *steps(): Generator<void, void, void> {
    for (const target of this.targets()) {
      if (target.type === 'text') this.checkText(target.node);
      else this.checkInput(target.element);
      yield;
    }
    yield* this.checkPage();
    yield* this.explain();
  }

  /** Layout may change while the scan is paused, so cached reads are dropped. */
  resetLayout(): void {
    this.layout.reset();
    this.clips.reset();
  }

  result(timing: SliceTiming): ScanResult {
    const root = this.doc.documentElement;
    return {
      findings: this.findings,
      stats: { ...this.counts, ...timing },
      viewport: { width: root.clientWidth, height: root.clientHeight },
    };
  }

  // ── Collection ────────────────────────────────────────────────────────────

  private get scope(): Document | Element {
    return this.options.root ?? this.doc;
  }

  private *targets(): Generator<Target> {
    const nodes = walkTree(this.doc, this.scope, SHOW_ELEMENT | SHOW_TEXT, this.options, {
      onFrame: () => {
        this.counts.framesSkipped += 1;
      },
      onShadowRoot: () => {
        this.counts.shadowRoots += 1;
      },
    });
    for (const node of nodes) {
      if (node.nodeType === TEXT_NODE) {
        const text = node as Text;
        if (/\S/.test(text.data)) yield { type: 'text', node: text };
      } else if (this.options.includeInputs !== false && isInput(node as Element)) {
        yield { type: 'input', element: node as HTMLInputElement };
      }
    }
  }

  private elements(): Generator<Element> {
    return walkTree(this.doc, this.scope, SHOW_ELEMENT, this.options) as Generator<Element>;
  }

  // ── Text ──────────────────────────────────────────────────────────────────

  private checkText(node: Text): void {
    const host = node.parentElement;
    if (!isHtmlElement(host)) {
      this.counts.skippedForeign += 1;
      return;
    }
    const layoutParent = node.assignedSlot ?? host;
    if (!this.layout.isRendered(layoutParent)) {
      this.counts.skippedInvisible += 1;
      return;
    }
    const geometry = measureText(this.range, node);
    if (!geometry) return;
    if (this.isUnreachable(geometry.bounds)) {
      // Parked where no one can scroll to, e.g. skip links waiting for focus.
      this.counts.skippedInvisible += 1;
      return;
    }
    this.counts.textNodes += 1;

    const tolerance = toleranceFor(this.layout.style(host));
    const clip = clipOverflow(geometry, this.clips.forContent(layoutParent));
    if (clip) {
      // Text that is entirely out of view is hidden on purpose: off-canvas
      // panels, collapsed sections, carousel slides, visually-hidden labels.
      if (clip.visibleFraction === 0) return;
      const x = clip.x > tolerance.x ? clip.x : 0;
      const y = clip.y > tolerance.y ? clip.y : 0;
      const clipperX = x > 0 ? clip.xBy : null;
      const clipperY = y > 0 ? clip.yBy : null;
      if (clipperX ?? clipperY) {
        if ([clipperX, clipperY].some((clipper) => clipper && this.isTinyBox(clipper))) return;
        const classified = this.classifyClip(clipperX, clipperY);
        if (!classified) return;
        this.recordText(host, {
          ...classified,
          element: host,
          overflow: { x, y },
          text: node.data,
          bounds: geometry.bounds,
        });
        return;
      }
    }

    const spill = this.findSpill(geometry.bounds, layoutParent, tolerance);
    if (spill) {
      this.recordText(host, {
        kind: 'spilling',
        mechanism: 'spill',
        element: host,
        container: spill.container,
        overflow: spill.overflow,
        text: node.data,
        bounds: geometry.bounds,
      });
    }
  }

  /**
   * Plain clipping wins over truncation: an ellipsis or line clamp only counts
   * when it is the sole reason text is lost.
   */
  private classifyClip(
    clipperX: Element | null,
    clipperY: Element | null,
  ): Pick<Draft, 'kind' | 'mechanism' | 'container'> | null {
    const ellipsis = clipperX !== null && this.layout.style(clipperX).textOverflow === 'ellipsis';
    const clamped = clipperY !== null && lineClamp(this.layout.style(clipperY)) !== null;
    if (clipperX && !ellipsis) return { kind: 'hidden', mechanism: 'clip', container: clipperX };
    if (clipperY && !clamped) return { kind: 'hidden', mechanism: 'clip', container: clipperY };
    if (clipperX) return { kind: 'truncated', mechanism: 'ellipsis', container: clipperX };
    if (clipperY) return { kind: 'truncated', mechanism: 'line-clamp', container: clipperY };
    return null;
  }

  /** Above or before the page origin, where scrolling can't reach (LTR: left; RTL: right). */
  private isUnreachable(bounds: Bounds): boolean {
    const { scrollX, scrollY } = this.layout.view;
    if (bounds.bottom + scrollY <= 0) return true;
    const root = this.doc.documentElement;
    return this.layout.style(root).direction === 'rtl'
      ? bounds.left + scrollX >= root.clientWidth
      : bounds.right + scrollX <= 0;
  }

  private isTinyBox(element: Element): boolean {
    const box = this.layout.paddingBox(element);
    return box.right - box.left < TINY_BOX || box.bottom - box.top < TINY_BOX;
  }

  /**
   * Text spills when its visible part extends past the box of an in-flow
   * ancestor that lets overflow show. Boxes that clip or scroll don't end the
   * walk: they trim what can be seen, and the clipping box itself may still be
   * pushed out of its parent (a flex child without `min-width: 0`). Deliberate
   * overhang is allowed: negative margins (full-bleed blocks) and floats
   * hanging below their container. The walk stops at out-of-flow boxes (menus
   * and tooltips may outgrow their anchor) and at the page root (handled as
   * page overflow). Overflow that runs into a scroll container's scrollable
   * area, right at its edge, is reachable and overlaps nothing.
   */
  private findSpill(
    bounds: Bounds,
    start: Element,
    tolerance: Tolerance,
  ): { container: Element; overflow: { x: number; y: number } } | null {
    const visible = { ...bounds };
    const overhang = { left: 0, right: 0, top: 0, bottom: 0 };
    let checkY = true;
    let isLineContainer = true;
    for (let element: Element | null = start; element; element = flatParent(element)) {
      if (isRootElement(element)) break;
      const style = this.layout.style(element);
      if (this.isComparableBox(style)) {
        const rect = this.layout.rect(element);
        // Text moved entirely outside its own box (text-indent tricks) is deliberate.
        if (
          isLineContainer &&
          !(
            visible.right > rect.left &&
            visible.left < rect.right &&
            visible.bottom > rect.top &&
            visible.top < rect.bottom
          )
        ) {
          return null;
        }
        isLineContainer = false;

        const clipsX = style.overflowX !== 'visible';
        const clipsY = style.overflowY !== 'visible';
        const past = {
          left: rect.left - overhang.left - visible.left,
          right: visible.right - (rect.right + overhang.right),
          top: rect.top - overhang.top - visible.top,
          bottom: visible.bottom - (rect.bottom + overhang.bottom),
        };
        const sideX = past.right >= past.left ? 'right' : 'left';
        const sideY = past.bottom >= past.top ? 'bottom' : 'top';
        const x = clipsX ? 0 : Math.max(0, past[sideX]);
        const y = clipsY || !checkY ? 0 : Math.max(0, past[sideY]);
        if (x > tolerance.x || y > tolerance.y) {
          const keptX = x > tolerance.x && !this.endsAtScrollEdge(element, sideX) ? x : 0;
          const keptY = y > tolerance.y && !this.endsAtScrollEdge(element, sideY) ? y : 0;
          return keptX > 0 || keptY > 0
            ? { container: element, overflow: { x: keptX, y: keptY } }
            : null;
        }
        if (clipsX || clipsY) {
          const box = this.layout.paddingBox(element);
          if (clipsX) {
            visible.left = Math.max(visible.left, box.left);
            visible.right = Math.min(visible.right, box.right);
          }
          if (clipsY) {
            visible.top = Math.max(visible.top, box.top);
            visible.bottom = Math.min(visible.bottom, box.bottom);
          }
          if (visible.right <= visible.left || visible.bottom <= visible.top) return null;
        }
        // Negative margins pull a box outside its parent on purpose.
        overhang.left += Math.max(0, -px(style.marginLeft));
        overhang.right += Math.max(0, -px(style.marginRight));
        overhang.top += Math.max(0, -px(style.marginTop));
        overhang.bottom += Math.max(0, -px(style.marginBottom));
        // Floats may hang below their container; the content after them flows around.
        if (style.float !== 'none') checkY = false;
      }
      if (style.position === 'absolute' || style.position === 'fixed') break;
    }
    return null;
  }

  /** Boxes that text is compared against; inline, `contents` and table-internal boxes are not. */
  private isComparableBox(style: CSSStyleDeclaration): boolean {
    return (
      style.display !== 'contents' &&
      style.display !== 'inline' &&
      !INTERNAL_TABLE_DISPLAYS.has(style.display)
    );
  }

  /**
   * True when the element's edge on `side` coincides with the scrollport edge
   * of an enclosing scroll container: whatever spills past it is simply that
   * container's scrollable content (code editors, chat logs).
   */
  private endsAtScrollEdge(element: Element, side: keyof Bounds): boolean {
    const edge = this.layout.rect(element)[side];
    const horizontal = side === 'left' || side === 'right';
    for (
      let ancestor = flatParent(element);
      ancestor && !isRootElement(ancestor);
      ancestor = flatParent(ancestor)
    ) {
      const style = this.layout.style(ancestor);
      if (!this.isComparableBox(style)) continue;
      if (Math.abs(this.layout.paddingBox(ancestor)[side] - edge) > 1) return false;
      const overflow = horizontal ? style.overflowX : style.overflowY;
      if (overflow === 'auto' || overflow === 'scroll') return true;
      if (overflow !== 'visible') return false;
    }
    return false;
  }

  // ── Inputs ────────────────────────────────────────────────────────────────

  private checkInput(input: HTMLInputElement): void {
    if (!TEXT_INPUT_TYPES.has(input.type) || !this.layout.isRendered(input)) return;
    this.counts.inputs += 1;

    const style = this.layout.style(input);
    const contentWidth = input.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
    if (input.value === '' && input.placeholder.trim() !== '') {
      const needed = this.placeholderWidth(input);
      const hidden = needed === null ? 0 : needed - contentWidth;
      if (hidden > PLACEHOLDER_TOLERANCE) {
        this.record({
          kind: 'input',
          mechanism: 'placeholder',
          element: input,
          container: input,
          overflow: { x: hidden, y: 0 },
          text: input.placeholder,
          bounds: null,
        });
      }
      return;
    }
    // Editable values scroll by design; read-only values can't be scrolled to.
    if (input.value !== '' && (input.readOnly || input.disabled)) {
      const hidden = input.scrollWidth - input.clientWidth;
      if (hidden > LINE_TOLERANCE) {
        this.record({
          kind: 'input',
          mechanism: 'value',
          element: input,
          container: input,
          overflow: { x: hidden, y: 0 },
          text: input.value,
          bounds: null,
        });
      }
    }
  }

  private placeholderWidth(input: HTMLInputElement): number | null {
    if (this.canvas === undefined) {
      this.canvas = this.doc.createElement('canvas').getContext('2d');
    }
    if (!this.canvas) return null;
    const style = this.layout.view.getComputedStyle(input, '::placeholder');
    this.canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    this.canvas.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
    return this.canvas.measureText(input.placeholder).width;
  }

  // ── Page ──────────────────────────────────────────────────────────────────

  private *checkPage(): Generator<void, void, void> {
    const root = this.doc.documentElement;
    const rootStyle = this.layout.style(root);
    // Typed as nullable on purpose: documents without a <body> (framesets, bare XML) exist.
    const body = this.doc.querySelector('body');
    const viewportOverflow =
      rootStyle.overflowX !== 'visible' || !body
        ? rootStyle.overflowX
        : this.layout.style(body).overflowX;
    // When the viewport clips horizontally, wide content is cut instead of scrollable.
    if (viewportOverflow === 'hidden' || viewportOverflow === 'clip') return;

    const viewportWidth = root.clientWidth;
    if (root.scrollWidth - viewportWidth <= LINE_TOLERANCE) return;

    const rtl = rootStyle.direction === 'rtl';
    const { scrollX } = this.layout.view;
    const pastEdge = (left: number, right: number) =>
      rtl ? -(left + scrollX) : right + scrollX - viewportWidth;
    const beyond = (element: Element) => {
      const rect = this.layout.rect(element);
      return rect.width === 0 && rect.height === 0 ? 0 : pastEdge(rect.left, rect.right);
    };

    for (const element of this.elements()) {
      yield;
      if (isRootElement(element)) continue;
      const excess = beyond(element);
      if (excess <= LINE_TOLERANCE) continue;
      const context = this.clips.forBox(element);
      if (context.containedX || context.viewportFixed) continue;
      if (!this.layout.isRendered(element)) continue;
      // Report only where the overflow starts, not every descendant of a wide box.
      const parent = this.parentBox(element);
      if (parent && !isRootElement(parent) && beyond(parent) > LINE_TOLERANCE) continue;
      this.record({
        kind: 'page-scroll',
        mechanism: 'page-overflow',
        element,
        container: element,
        overflow: { x: excess, y: 0 },
        text: element.textContent,
        bounds: null,
      });
    }

    // Text spilling past the viewport widens the page even when no box does.
    for (const [host, byKind] of this.drafts) {
      const spill = byKind.get('spilling');
      if (!spill?.bounds || byKind.has('page-scroll')) continue;
      if (this.clips.forContent(host).containedX) continue;
      const excess = pastEdge(spill.bounds.left, spill.bounds.right);
      if (excess > LINE_TOLERANCE) {
        this.record({ ...spill, kind: 'page-scroll', mechanism: 'page-overflow', container: host });
      }
      yield;
    }
  }

  /** The box an element is positioned and sized against. */
  private parentBox(element: Element): Element | null {
    const position = this.layout.style(element).position;
    if (position === 'absolute' || position === 'fixed') {
      return this.clips.containingBlock(element, position === 'absolute');
    }
    let parent = flatParent(element);
    while (parent && this.layout.style(parent).display === 'contents') {
      parent = flatParent(parent);
    }
    return parent;
  }

  // ── Recording and explanation ─────────────────────────────────────────────

  private record(draft: Draft): void {
    let byKind = this.drafts.get(draft.element);
    if (!byKind) {
      byKind = new Map();
      this.drafts.set(draft.element, byKind);
    }
    const existing = byKind.get(draft.kind);
    if (!existing) {
      byKind.set(draft.kind, draft);
      return;
    }
    existing.overflow = {
      x: Math.max(existing.overflow.x, draft.overflow.x),
      y: Math.max(existing.overflow.y, draft.overflow.y),
    };
    if (existing.bounds && draft.bounds) existing.bounds = union(existing.bounds, draft.bounds);
    if (!existing.text.includes(draft.text)) existing.text = `${existing.text} ${draft.text}`;
  }

  /** Records a text finding, keeping only the most serious text problem per element. */
  private recordText(host: Element, draft: Draft): void {
    const byKind = this.drafts.get(host);
    const rank = TEXT_KIND_PRECEDENCE.indexOf(draft.kind);
    for (const kind of TEXT_KIND_PRECEDENCE) {
      if (!byKind?.has(kind) || kind === draft.kind) continue;
      if (TEXT_KIND_PRECEDENCE.indexOf(kind) < rank) return;
      byKind.delete(kind);
    }
    this.record(draft);
  }

  private *explain(): Generator<void, void, void> {
    const viewportWidth = this.doc.documentElement.clientWidth;
    for (const byKind of this.drafts.values()) {
      for (const draft of byKind.values()) {
        const overflow = { x: round(draft.overflow.x), y: round(draft.overflow.y) };
        const axes: Axis[] = [];
        if (overflow.x > 0) axes.push('x');
        if (overflow.y > 0) axes.push('y');
        this.findings.push({
          kind: draft.kind,
          severity: SEVERITY_BY_KIND[draft.kind],
          mechanism: draft.mechanism,
          element: draft.element,
          container: draft.container,
          axes,
          overflow,
          text: sampleText(draft.text),
          diagnosis: diagnose(this.layout, {
            kind: draft.kind,
            mechanism: draft.mechanism,
            element: draft.element,
            container: draft.container,
            overflow,
            text: draft.text,
            viewportWidth,
          }),
        });
        yield;
      }
    }
  }
}

/**
 * Scans a document synchronously. Use for tests, small documents, and scoped
 * checks that must not pause; the extension uses `scanDocumentAsync` for pages.
 */
export function scanDocument(doc: Document, options: ScanOptions = {}): ScanResult {
  const session = new ScanSession(doc, options);
  return session.result(runToEnd(doc, session.steps(), options));
}

/**
 * Scans a document in time slices (default 8 ms of work each), yielding to the
 * page between slices so no task comes near the 50 ms long-task threshold.
 */
export async function scanDocumentAsync(
  doc: Document,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const session = new ScanSession(doc, options);
  const timing = await runInSlices(doc, session.steps(), options, () => {
    session.resetLayout();
    options.onProgress?.(session.counts.textNodes);
  });
  return session.result(timing);
}
