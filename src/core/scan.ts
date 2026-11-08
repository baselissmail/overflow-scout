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
  isShadowRoot,
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
/** Text that runs sideways out of its box by less than this is a glyph's overhang. */
const SPILL_TOLERANCE = 2;
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

/** Room beyond the text, in px, that shows a box was sized by layout rather than by its text. */
const PLACED_ROOM = 12;

/** How far up, and how many boxes, to look for something spilled text lands on. */
const NEIGHBOUR_DEPTH = 4;
const NEIGHBOUR_LIMIT = 200;

/**
 * The alpha of a computed color: `rgba()` and the slash syntax of `oklch()`,
 * `oklab()`, `color()` and friends. Anything else counts as opaque.
 */
function alphaOf(color: string): number {
  if (color === 'transparent') return 0;
  const slash = /\/\s*([\d.]+)(%?)\s*\)\s*$/.exec(color);
  if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
  const legacy = /^rgba\(([^)]*)\)$/.exec(color);
  const parts = legacy?.[1]?.split(',') ?? [];
  return parts.length === 4 ? Number(parts[3]) : 1;
}

/** Whether any layer of a computed `box-shadow` paints: a color with alpha and some size. */
function shadowShows(value: string): boolean {
  if (value === 'none') return false;
  // Layers are comma-separated, but colors contain commas too.
  const layers = value.split(/,(?![^(]*\))/);
  return layers.some((layer) => {
    const color = /(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\([^)]*\)|transparent/.exec(layer);
    if (color && alphaOf(color[0]) === 0) return false;
    const lengths = (layer.replace(color?.[0] ?? '', '').match(/-?[\d.]+px/g) ?? []).map(px);
    return lengths.some((length) => length !== 0);
  });
}

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
  /** Per box: whether each edge is visible, what's behind it, and what's next to it. */
  private readonly edges = new Map<Element, Partial<Record<keyof Bounds, boolean>>>();
  private readonly backdrops = new Map<Element, string>();
  private readonly neighbours = new Map<Element, readonly Bounds[] | null>();

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
    this.edges.clear();
    this.backdrops.clear();
    this.neighbours.clear();
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
      // Cropped on purpose: the cut lies past the page's edge (hero art bleeding
      // off-screen), or the text's own box was placed past it (a carousel's next slide).
      const cropped =
        clip.x > tolerance.x &&
        (this.cutOffPage(clip.xBy, geometry.bounds) ||
          this.boxPlacedPast(host, clip.xBy, geometry.bounds));
      const x = clip.x > tolerance.x && !cropped ? clip.x : 0;
      const y = clip.y > tolerance.y ? clip.y : 0;
      // What a crop hides isn't spilling either: it's out of view.
      if (cropped && y === 0) return;
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

  /**
   * True when a box cuts text horizontally at an edge outside the page's
   * reachable width: the window shows the page's edge there, not the cut.
   */
  private cutOffPage(clipper: Element | null, bounds: Bounds): boolean {
    if (!clipper) return false;
    const box = this.layout.paddingBox(clipper);
    const root = this.doc.documentElement;
    const { scrollX } = this.layout.view;
    const body = this.doc.body as Element | null;
    // Only these stop sideways scrolling; `auto` is what `overflow-y: scroll` turns x into.
    const hidesX = [root, body].some((element) => {
      const overflow = element ? this.layout.style(element).overflowX : 'visible';
      return overflow === 'hidden' || overflow === 'clip';
    });
    const extra = hidesX ? 0 : Math.max(0, root.scrollWidth - root.clientWidth);
    // Document x the page can scroll across: right of the origin, or left of it in RTL.
    const rtl = this.layout.style(root).direction === 'rtl';
    const min = rtl ? -extra : 0;
    const max = rtl ? root.clientWidth : root.clientWidth + extra;
    const cutRight = bounds.right - box.right >= box.left - bounds.left;
    // At the edge itself the cut shows; only past it is it out of sight.
    return cutRight ? box.right + scrollX > max + 1 : box.left + scrollX < min - 1;
  }

  /**
   * True when the text sits in a box of its own that is placed past the
   * clipping edge (a carousel's next slide peeking in, a product mock bleeding
   * off a hero frame): that box is cropped; its text didn't outgrow it. Walking
   * up from the text, the first box that ends inside the clip edge means the
   * text did outgrow it; a box that crosses the edge with room to spare beyond
   * the text means the box was placed there.
   */
  private boxPlacedPast(host: Element, clipper: Element | null, bounds: Bounds): boolean {
    if (!clipper) return false;
    const edge = this.layout.paddingBox(clipper);
    const right = bounds.right - edge.right >= edge.left - bounds.left;
    for (let element: Element | null = host; element && element !== clipper;) {
      if (this.isComparableBox(this.layout.style(element))) {
        const box = this.layout.rect(element);
        if (right ? box.right <= edge.right + 1 : box.left >= edge.left - 1) return false;
        // Room inside the content box: a button's own padding isn't room to spare.
        const style = this.layout.style(element);
        const room = right
          ? box.right - px(style.borderRightWidth) - px(style.paddingRight) - bounds.right
          : bounds.left - (box.left + px(style.borderLeftWidth) + px(style.paddingLeft));
        if (room > PLACED_ROOM) return true;
      }
      element = flatParent(element);
    }
    return false;
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
          const edge = {
            left: rect.left - overhang.left,
            right: rect.right + overhang.right,
            top: rect.top - overhang.top,
            bottom: rect.bottom + overhang.bottom,
          };
          // Code (preformatted text) is meant to scroll, past per-line highlights too.
          const code = this.layout.style(start).whiteSpace.startsWith('pre');
          const scrollsX = x > tolerance.x && this.endsAtScrollEdge(element, sideX, code);
          const scrollsY = y > tolerance.y && this.endsAtScrollEdge(element, sideY, code);
          // Sideways, text that outgrew its box always shows (it runs into margins, the next
          // column, or off-screen), unless by less than a glyph's overhang. When a wider box
          // of its own runs past this one instead (a mock bleeding out of its column), it shows
          // only past a visible edge or onto something else, as it does downwards.
          const placedX = x > tolerance.x && this.boxPlacedPast(start, element, visible);
          const keptX =
            x > Math.max(tolerance.x, SPILL_TOLERANCE) &&
            !scrollsX &&
            (!placedX || this.spillShows(element, sideX, visible, edge))
              ? x
              : 0;
          const keptY =
            y > tolerance.y && !scrollsY && this.spillShows(element, sideY, visible, edge) ? y : 0;
          if (keptX > 0 || keptY > 0)
            return { container: element, overflow: { x: keptX, y: keptY } };
          // Reachable by scrolling: that container's content, not a spill.
          if (scrollsX || scrollsY) return null;
          // An edge no one sees, with nothing underneath: an outer box may still show it.
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

  /**
   * Whether content running past a box's edge can be seen as broken: the edge
   * itself is visible (a border, a shadow, or a background unlike what's
   * behind it), or the content lands on a neighbouring box. Layout wrappers
   * (a `100vh` shell, a fixed-height hero row, a column a mock bleeds out of)
   * have neither, so content running out of them reads as if the box were
   * bigger.
   */
  private spillShows(element: Element, side: keyof Bounds, visible: Bounds, edge: Bounds): boolean {
    if (this.hasVisibleEdge(element, side)) return true;
    const region: Bounds =
      side === 'right'
        ? { ...visible, left: edge.right }
        : side === 'left'
          ? { ...visible, right: edge.left }
          : side === 'bottom'
            ? { ...visible, top: edge.bottom }
            : { ...visible, bottom: edge.top };
    return this.overlapsNeighbour(element, region);
  }

  private hasVisibleEdge(element: Element, side: keyof Bounds): boolean {
    const cached = this.edges.get(element)?.[side];
    if (cached !== undefined) return cached;
    const visible = this.measureEdge(element, side);
    this.edges.set(element, { ...this.edges.get(element), [side]: visible });
    return visible;
  }

  private measureEdge(element: Element, side: keyof Bounds): boolean {
    const style = this.layout.style(element);
    const border = (property: string) => style.getPropertyValue(`border-${side}-${property}`);
    const borderStyle = border('style');
    if (
      px(border('width')) > 0 &&
      borderStyle !== 'none' &&
      borderStyle !== 'hidden' &&
      alphaOf(border('color')) > 0
    ) {
      return true;
    }
    if (shadowShows(style.boxShadow) || style.backgroundImage !== 'none') return true;
    return alphaOf(style.backgroundColor) > 0 && style.backgroundColor !== this.backdropOf(element);
  }

  /** The color behind an element: its nearest painted ancestor, or the canvas. */
  private backdropOf(element: Element): string {
    const cached = this.backdrops.get(element);
    if (cached !== undefined) return cached;
    let backdrop: string | undefined;
    for (
      let ancestor = flatParent(element);
      ancestor && !backdrop;
      ancestor = flatParent(ancestor)
    ) {
      const style = this.layout.style(ancestor);
      if (style.backgroundImage !== 'none') backdrop = 'image';
      else if (alphaOf(style.backgroundColor) > 0) backdrop = style.backgroundColor;
    }
    backdrop ??= this.canvasColor();
    this.backdrops.set(element, backdrop);
    return backdrop;
  }

  /** The page's canvas when nothing paints a background: white, or dark in a dark color scheme. */
  private canvasColor(): string {
    const scheme = this.layout.style(this.doc.documentElement).colorScheme;
    const dark =
      scheme.includes('dark') &&
      (!scheme.includes('light') ||
        this.layout.view.matchMedia('(prefers-color-scheme: dark)').matches);
    return dark ? 'rgb(18, 18, 18)' : 'rgb(255, 255, 255)';
  }

  /** True when a region overlaps an in-flow sibling of the box or of its nearby ancestors. */
  private overlapsNeighbour(element: Element, region: Bounds): boolean {
    const rects = this.neighbourRects(element);
    // Too many to look at: assume something is there rather than spend more time.
    if (rects === null) return true;
    return rects.some((rect) => {
      const width = Math.min(rect.right, region.right) - Math.max(rect.left, region.left);
      const height = Math.min(rect.bottom, region.bottom) - Math.max(rect.top, region.top);
      return width > 1 && height > 1;
    });
  }

  /** The boxes next to an element and its nearby ancestors that content could land on. */
  private neighbourRects(element: Element): readonly Bounds[] | null {
    const cached = this.neighbours.get(element);
    if (cached !== undefined) return cached;
    const rects: Bounds[] = [];
    let checked = 0;
    let node: Element | null = element;
    let result: Bounds[] | null = rects;
    for (let depth = 0; node && depth < NEIGHBOUR_DEPTH && !isRootElement(node); depth += 1) {
      // A positioned layer overlaps its siblings by design (stacked illustrations, overlays).
      const position = this.layout.style(node).position;
      if (position === 'absolute' || position === 'fixed') break;
      // Siblings in the rendered tree: a shadow root's top-level children count too.
      const parent: ParentNode | null =
        node.parentElement ?? (isShadowRoot(node.parentNode) ? node.parentNode : null);
      for (const sibling of parent ? Array.from(parent.children) : []) {
        if (sibling === node) continue;
        checked += 1;
        if (checked > NEIGHBOUR_LIMIT) {
          result = null;
          break;
        }
        const style = this.layout.style(sibling);
        if (style.display === 'none' || style.visibility !== 'visible') continue;
        // Overlays and decorations positioned over the area aren't "what comes next".
        if (style.position === 'absolute' || style.position === 'fixed') continue;
        rects.push(this.layout.rect(sibling));
      }
      if (result === null) break;
      node = flatParent(node);
    }
    this.neighbours.set(element, result);
    return result;
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
  private endsAtScrollEdge(element: Element, side: keyof Bounds, code = false): boolean {
    // Prose that visibly crosses a border on the way isn't just scrollable content.
    if (!code && this.hasVisibleEdge(element, side)) return false;
    const edge = this.layout.rect(element)[side];
    const horizontal = side === 'left' || side === 'right';
    for (
      let ancestor = flatParent(element);
      ancestor && !isRootElement(ancestor);
      ancestor = flatParent(ancestor)
    ) {
      const style = this.layout.style(ancestor);
      if (!this.isComparableBox(style)) continue;
      const overflow = horizontal ? style.overflowX : style.overflowY;
      const scrolls = overflow === 'auto' || overflow === 'scroll';
      if (!code && !scrolls && this.hasVisibleEdge(ancestor, side)) return false;
      // A scroll container's padding scrolls with its content: nothing else can sit there.
      const padding = scrolls ? px(style.getPropertyValue(`padding-${side}`)) : 0;
      if (Math.abs(this.layout.paddingBox(ancestor)[side] - edge) > padding + 1) return false;
      if (scrolls) return true;
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
