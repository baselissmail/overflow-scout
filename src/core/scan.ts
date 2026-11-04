import { diagnose } from './diagnose/diagnose';
import {
  FILTER_ACCEPT,
  FILTER_REJECT,
  SHOW_ELEMENT,
  SHOW_TEXT,
  TEXT_NODE,
  flatParent,
  isElement,
  isHtmlElement,
  isInput,
  isRootElement,
  sampleText,
  windowOf,
} from './dom';
import { ClipResolver } from './measure/clip';
import type { Bounds } from './measure/layout';
import { LayoutReader, px } from './measure/layout';
import { clipOverflow, measureText } from './measure/text';
import type {
  Axis,
  Finding,
  FindingKind,
  Mechanism,
  ScanOptions,
  ScanResult,
  ScanStats,
} from './types';
import { SEVERITY_BY_KIND } from './types';

/** Horizontal overflow below this many CSS px is rounding noise. */
const TOLERANCE_X = 1;
/** Canvas and layout text widths differ slightly. */
const PLACEHOLDER_TOLERANCE = 2;
/** Clip boxes smaller than this hide text on purpose (visually-hidden patterns). */
const TINY_BOX = 2;
/**
 * Vertical overflow must exceed a quarter of the font size: line boxes with a
 * tight line-height routinely overflow by a few pixels of empty ascender or
 * descender space without hiding anything readable.
 */
const minVerticalOverflow = (fontSize: number) => Math.max(2, fontSize * 0.25);

/** Subtrees that don't render page text we can measure. */
const SKIPPED_SUBTREES = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'head',
  'svg',
  'math',
  'select',
  'datalist',
  'textarea',
  'canvas',
  'video',
  'audio',
]);
const FRAME_TAGS = new Set(['iframe', 'frame', 'object', 'embed']);
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

class ScanSession {
  readonly stats: ScanStats = {
    textNodes: 0,
    inputs: 0,
    skippedInvisible: 0,
    skippedForeign: 0,
    shadowRoots: 0,
    framesSkipped: 0,
    durationMs: 0,
    wallMs: 0,
    slices: 0,
    longestSliceMs: 0,
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
    for (const target of this.targets(this.doc)) {
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

  recordSlice(durationMs: number): void {
    this.stats.slices += 1;
    this.stats.durationMs += durationMs;
    this.stats.longestSliceMs = Math.max(this.stats.longestSliceMs, durationMs);
  }

  result(): ScanResult {
    const root = this.doc.documentElement;
    return {
      findings: this.findings,
      stats: {
        ...this.stats,
        durationMs: round(this.stats.durationMs),
        wallMs: round(this.stats.wallMs),
        longestSliceMs: round(this.stats.longestSliceMs),
      },
      viewport: { width: root.clientWidth, height: root.clientHeight },
    };
  }

  // ── Collection ────────────────────────────────────────────────────────────

  private walker(root: Document | ShadowRoot, show: number): TreeWalker {
    const { ignore } = this.options;
    return this.doc.createTreeWalker(root, show, {
      acceptNode: (node) => {
        if (!isElement(node)) return FILTER_ACCEPT;
        if (FRAME_TAGS.has(node.localName)) return FILTER_REJECT;
        if (SKIPPED_SUBTREES.has(node.localName) || ignore?.(node)) return FILTER_REJECT;
        return FILTER_ACCEPT;
      },
    });
  }

  private shadowRootOf(element: Element): ShadowRoot | null {
    return element.shadowRoot ?? this.options.openShadowRoot?.(element) ?? null;
  }

  private *targets(root: Document | ShadowRoot): Generator<Target> {
    const walker = this.walker(root, SHOW_ELEMENT | SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === TEXT_NODE) {
        const text = node as Text;
        if (/\S/.test(text.data)) yield { type: 'text', node: text };
        continue;
      }
      const element = node as Element;
      if (FRAME_TAGS.has(element.localName)) this.stats.framesSkipped += 1;
      if (isInput(element)) yield { type: 'input', element };
      const shadow = this.shadowRootOf(element);
      if (shadow) {
        this.stats.shadowRoots += 1;
        yield* this.targets(shadow);
      }
    }
  }

  private *elements(root: Document | ShadowRoot): Generator<Element> {
    const walker = this.walker(root, SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node as Element;
      yield element;
      const shadow = this.shadowRootOf(element);
      if (shadow) yield* this.elements(shadow);
    }
  }

  // ── Text ──────────────────────────────────────────────────────────────────

  private checkText(node: Text): void {
    const host = node.parentElement;
    if (!isHtmlElement(host)) {
      this.stats.skippedForeign += 1;
      return;
    }
    const layoutParent = node.assignedSlot ?? host;
    if (!this.layout.isRendered(layoutParent)) {
      this.stats.skippedInvisible += 1;
      return;
    }
    const geometry = measureText(this.range, node);
    if (!geometry) return;
    this.stats.textNodes += 1;

    const minY = minVerticalOverflow(px(this.layout.style(host).fontSize));
    const clip = clipOverflow(geometry, this.clips.forContent(layoutParent));
    if (clip) {
      // Text that is entirely out of view is hidden on purpose: off-canvas
      // panels, collapsed sections, carousel slides, visually-hidden labels.
      if (clip.visibleFraction === 0) return;
      const x = clip.x > TOLERANCE_X ? clip.x : 0;
      const y = clip.y > minY ? clip.y : 0;
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

    const spill = this.findSpill(geometry.bounds, layoutParent, minY);
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

  private isTinyBox(element: Element): boolean {
    const box = this.layout.paddingBox(element);
    return box.right - box.left < TINY_BOX || box.bottom - box.top < TINY_BOX;
  }

  /**
   * Text spills when its visible part extends past the box of an in-flow
   * ancestor that lets overflow show. Boxes that clip or scroll don't end the
   * walk: they trim what can be seen, and the clipping box itself may still be
   * pushed out of its parent (a flex child without `min-width: 0`). The walk
   * stops at out-of-flow boxes (menus and tooltips may outgrow their anchor)
   * and at the page root (handled as page overflow).
   */
  private findSpill(
    bounds: Bounds,
    start: Element,
    minY: number,
  ): { container: Element; overflow: { x: number; y: number } } | null {
    const { scrollX, scrollY } = this.layout.view;
    // Text parked in unreachable negative space (off-canvas panels) is deliberate.
    if (bounds.right + scrollX <= 0 || bounds.bottom + scrollY <= 0) return null;

    const visible = { ...bounds };
    let isLineContainer = true;
    for (let element: Element | null = start; element; element = flatParent(element)) {
      if (isRootElement(element)) break;
      const style = this.layout.style(element);
      if (style.display !== 'contents' && style.display !== 'inline') {
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
        const x = clipsX ? 0 : Math.max(0, visible.right - rect.right, rect.left - visible.left);
        const y = clipsY ? 0 : Math.max(0, visible.bottom - rect.bottom, rect.top - visible.top);
        if (x > TOLERANCE_X || y > minY) {
          return {
            container: element,
            overflow: { x: x > TOLERANCE_X ? x : 0, y: y > minY ? y : 0 },
          };
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
      }
      if (style.position === 'absolute' || style.position === 'fixed') break;
    }
    return null;
  }

  // ── Inputs ────────────────────────────────────────────────────────────────

  private checkInput(input: HTMLInputElement): void {
    if (!TEXT_INPUT_TYPES.has(input.type) || !this.layout.isRendered(input)) return;
    this.stats.inputs += 1;

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
      if (hidden > TOLERANCE_X) {
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
    if (root.scrollWidth - viewportWidth <= TOLERANCE_X) return;

    const rtl = rootStyle.direction === 'rtl';
    const { scrollX } = this.layout.view;
    const pastEdge = (left: number, right: number) =>
      rtl ? -(left + scrollX) : right + scrollX - viewportWidth;
    const beyond = (element: Element) => {
      const rect = this.layout.rect(element);
      return rect.width === 0 && rect.height === 0 ? 0 : pastEdge(rect.left, rect.right);
    };

    for (const element of this.elements(this.doc)) {
      yield;
      if (isRootElement(element)) continue;
      const excess = beyond(element);
      if (excess <= TOLERANCE_X) continue;
      const context = this.clips.forBox(element);
      if (context.containedX || context.viewportFixed) continue;
      if (!this.layout.isRendered(element)) continue;
      // Report only where the overflow starts, not every descendant of a wide box.
      const parent = this.parentBox(element);
      if (parent && !isRootElement(parent) && beyond(parent) > TOLERANCE_X) continue;
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
      if (excess > TOLERANCE_X) {
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

function defaultClock(doc: Document): () => number {
  const { performance } = windowOf(doc);
  return () => performance.now();
}

/** `scheduler.yield()` resumes ahead of other queued tasks (Chrome 129+; we require 142). */
function defaultYield(view: Window): () => Promise<void> {
  return () => view.scheduler.yield();
}

/**
 * Scans a document synchronously. Use for tests and small documents; the
 * extension uses `scanDocumentAsync` so long scans never block the page.
 */
export function scanDocument(doc: Document, options: ScanOptions = {}): ScanResult {
  const session = new ScanSession(doc, options);
  const now = options.now ?? defaultClock(doc);
  const started = now();
  const steps = session.steps();
  while (!steps.next().done) {
    // Run every step without pausing.
  }
  const elapsed = now() - started;
  session.recordSlice(elapsed);
  session.stats.wallMs = elapsed;
  return session.result();
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
  const now = options.now ?? defaultClock(doc);
  const sliceMs = options.sliceMs ?? 8;
  const yieldToHost = options.yieldToHost ?? defaultYield(windowOf(doc));

  const steps = session.steps();
  const started = now();
  let sliceStart = started;
  while (!steps.next().done) {
    if (now() - sliceStart >= sliceMs) {
      session.recordSlice(now() - sliceStart);
      await yieldToHost();
      session.resetLayout();
      sliceStart = now();
    }
  }
  session.recordSlice(now() - sliceStart);
  session.stats.wallMs = now() - started;
  return session.result();
}
