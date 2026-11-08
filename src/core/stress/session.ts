import { FRAME_TAGS, SKIPPED_SUBTREES, walkTree } from '../collect';
import {
  SHOW_ELEMENT,
  SHOW_TEXT,
  TEXT_NODE,
  flatParent,
  isElement,
  isHtmlElement,
  isShadowRoot,
  windowOf,
} from '../dom';
import { clockFor, runInSlices, withSlice } from '../schedule';
import type { SliceOptions, SliceTiming, TraversalOptions } from '../types';
import type { StressIntensity } from './expansion';
import { isIconFont, isUntouchable } from './filters';
import type { StressStrategy, TextStressOptions } from './generate';
import { hasLetters, stressParts, textLength } from './generate';
import type { RevertResult, StressedAttribute } from './ledger';
import { StressLedger } from './ledger';
import type { SampleLanguage } from './samples';

export interface StressOptions extends TraversalOptions, SliceOptions {
  /** Default `translation`. */
  strategy?: StressStrategy;
  /** Default `worst`. */
  intensity?: StressIntensity;
  /** Makes every string this many times as long instead (see `TextStressOptions`). */
  scale?: number | undefined;
  /** Language for the `language` strategy. Default `de`. */
  language?: SampleLanguage;
  /** Sets `dir="rtl"` on the root element while stress is active. */
  rtl?: boolean;
  /** Seed for generated text; the same seed gives the same text. */
  seed?: number;
  /** Only stress text inside this element (a picked region). Default: the whole page. */
  scope?: Element;
}

export interface StressStats extends SliceTiming {
  /** Strings stressed: blocks of text, placeholders, and button labels. */
  strings: number;
  textNodes: number;
  placeholders: number;
  buttonValues: number;
  /** Total characters after stress ÷ before. */
  growth: number;
}

export interface Size {
  width: number;
  height: number;
}

const DEFAULT_SEED = 1;

/** Display values that keep text in the surrounding line, as part of the same string. */
const INLINE_DISPLAYS = new Set(['inline', 'contents', 'ruby', 'ruby-base', 'ruby-text']);
const BUTTON_TYPES = new Set(['submit', 'button', 'reset']);
/** Input types that show a placeholder. */
const PLACEHOLDER_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);
const OBSERVED_ATTRIBUTES: StressedAttribute[] = ['placeholder', 'value', 'dir'];

interface PlannedString {
  nodes: Text[];
  /** The values seen while planning; a node that changes before commit is skipped. */
  seen: string[];
  values: string[];
}

interface PlannedAttribute {
  element: Element;
  name: StressedAttribute;
  seen: string;
  value: string;
}

/**
 * Applies stress text to a page and reverts it exactly. Planning reads the
 * page in time slices; all writes then happen in one synchronous commit, so
 * the page never paints a half-stressed state.
 */
export class StressSession {
  private readonly ledger = new StressLedger();
  private readonly roots = new Set<Document | ShadowRoot>();
  private sizes = new WeakMap<Element, Size>();
  private readonly fresh = new Set<Text>();
  private readonly listeners = new Set<(pending: number) => void>();
  private observer: MutationObserver | null = null;
  private lastPending = 0;
  private applying = false;
  private applied = false;
  /** Bumped by every revert, so an apply that was still planning never commits. */
  private epoch = 0;

  constructor(
    readonly doc: Document,
    readonly options: StressOptions = {},
  ) {}

  /** True while stress text is on the page. */
  get active(): boolean {
    return this.applied;
  }

  private get textOptions(): TextStressOptions {
    return {
      strategy: this.options.strategy ?? 'translation',
      intensity: this.options.intensity ?? 'worst',
      language: this.options.language ?? 'de',
      seed: this.options.seed ?? DEFAULT_SEED,
      ...(this.options.scale !== undefined && { scale: this.options.scale }),
    };
  }

  /**
   * Stresses every string in scope. Calling it again re-applies stress to text
   * the page re-rendered or added since, and leaves stressed text as it is.
   */
  async apply(): Promise<StressStats> {
    if (this.applying) throw new Error('Overflow Scout: a stress pass is already running');
    this.applying = true;
    const epoch = this.epoch;
    try {
      const plan: { strings: PlannedString[]; attributes: PlannedAttribute[] } = {
        strings: [],
        attributes: [],
      };
      const timing = await runInSlices(this.doc, this.plan(plan), this.options);
      if (epoch !== this.epoch) {
        throw new Error('Overflow Scout: stress was reverted before it was applied');
      }
      const now = clockFor(this.doc, this.options);
      const commitStart = now();
      const committed = this.commit(plan);
      const commitMs = now() - commitStart;
      this.applied = true;
      this.fresh.clear();
      if (this.listeners.size > 0) this.startObserving();
      this.observer?.takeRecords();
      this.notify();
      return { ...withSlice(timing, commitMs), ...committed };
    } finally {
      this.applying = false;
    }
  }

  /**
   * Puts back every original value the page hasn't changed since. An apply
   * that is still planning is cancelled and rejects.
   */
  revert(): RevertResult {
    this.epoch += 1;
    this.observer?.disconnect();
    this.observer = null;
    const result = this.ledger.revert();
    this.applied = false;
    this.fresh.clear();
    this.sizes = new WeakMap();
    this.lastPending = 0;
    return result;
  }

  /** Strings the page re-rendered or added since stress was applied. */
  pending(): number {
    let fresh = 0;
    for (const node of this.fresh) {
      if (node.isConnected && !this.ledger.ownsText(node)) fresh += 1;
    }
    return this.ledger.changedByPage() + fresh;
  }

  /**
   * Calls `listener` whenever the number of pending strings changes, so the UI
   * can offer "Page re-rendered 12 strings · Re-apply". Returns an unsubscribe.
   */
  watch(listener: (pending: number) => void): () => void {
    this.listeners.add(listener);
    this.startObserving();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.observer?.disconnect();
        this.observer = null;
      }
    };
  }

  /** The element's size before stress was first applied, if it was measured. */
  sizeBefore(element: Element): Size | undefined {
    return this.sizes.get(element);
  }

  /** The element's text before stress (whitespace collapsed), or null if none of it is stressed. */
  originalTextOf(element: Element): string | null {
    const placeholder = this.ledger.attributeEntries(element)[0];
    if (placeholder) return placeholder.original;
    let stressed = false;
    const parts: string[] = [];
    for (const node of walkTree(this.doc, element, SHOW_TEXT, this.options)) {
      const entry = this.ledger.textEntry(node as Text);
      stressed ||= entry !== undefined;
      parts.push(entry?.original ?? (node as Text).data);
    }
    return stressed ? parts.join('').replace(/\s+/g, ' ').trim() : null;
  }

  /** How much longer the element's stressed text became (after ÷ before), or null. */
  growthOf(element: Element): number | null {
    let before = 0;
    let after = 0;
    for (const entry of this.ledger.attributeEntries(element)) {
      before += textLength([entry.original ?? '']);
      after += textLength([entry.written]);
    }
    if (before === 0) {
      for (const node of walkTree(this.doc, element, SHOW_TEXT, this.options)) {
        const entry = this.ledger.textEntry(node as Text);
        if (!entry) continue;
        before += textLength([entry.original]);
        after += textLength([entry.written]);
      }
    }
    return before > 0 && after !== before ? Math.round((after / before) * 10) / 10 : null;
  }

  // ── Planning ──────────────────────────────────────────────────────────────

  private *plan(plan: { strings: PlannedString[]; attributes: PlannedAttribute[] }) {
    const view = windowOf(this.doc);
    const styles = new Map<Element, CSSStyleDeclaration>();
    const style = (element: Element) => {
      let value = styles.get(element);
      if (!value) {
        value = view.getComputedStyle(element);
        styles.set(element, value);
      }
      return value;
    };
    const blocks = new Map<Element, Element>();
    const blockOf = (host: Element): Element => {
      const cached = blocks.get(host);
      if (cached) return cached;
      const display = style(host).display;
      const parent = flatParent(host);
      const block = INLINE_DISPLAYS.has(display) && parent ? blockOf(parent) : host;
      blocks.set(host, block);
      return block;
    };
    // Sizes are only meaningful before any stress is on the page.
    const measureSizes = this.ledger.size === 0;
    const measure = (host: Element) => {
      for (let element: Element | null = host; element; element = flatParent(element)) {
        if (this.sizes.has(element)) break;
        const rect = element.getBoundingClientRect();
        this.sizes.set(element, { width: rect.width, height: rect.height });
      }
    };

    const strings = new Map<Element, Text[]>();
    const attributeTargets: { element: Element; name: StressedAttribute }[] = [];
    const scope = this.options.scope ?? this.doc;
    const scopeRoot = scope.getRootNode();
    this.roots.add(isShadowRoot(scopeRoot) ? scopeRoot : this.doc);
    const nodes = walkTree(this.doc, scope, SHOW_ELEMENT | SHOW_TEXT, this.options, {
      skip: isUntouchable,
      onShadowRoot: (root) => this.roots.add(root),
      onSkippedTag: (element) => {
        if (
          element.localName === 'textarea' &&
          hasLetters(element.getAttribute('placeholder') ?? '')
        ) {
          attributeTargets.push({ element, name: 'placeholder' });
        }
      },
    });

    for (const node of nodes) {
      if (node.nodeType !== TEXT_NODE) {
        const element = node as Element;
        if (element.localName === 'input' && isHtmlElement(element)) {
          const type = (element.getAttribute('type') ?? 'text').toLowerCase();
          if (BUTTON_TYPES.has(type)) {
            if (hasLetters(this.ledger.originalAttribute(element, 'value') ?? '')) {
              attributeTargets.push({ element, name: 'value' });
            }
          } else if (
            PLACEHOLDER_TYPES.has(type) &&
            hasLetters(this.ledger.originalAttribute(element, 'placeholder') ?? '')
          ) {
            attributeTargets.push({ element, name: 'placeholder' });
          }
        }
        continue;
      }
      // Text without letters (numbers, spaces between inline elements) is kept
      // in its string so the string's length is right; it is never rewritten.
      const text = node as Text;
      const host = text.parentElement;
      if (!host || text.data === '' || isIconFont(style(host))) continue;
      const block = blockOf(text.assignedSlot ?? host);
      const list = strings.get(block);
      if (list) list.push(text);
      else strings.set(block, [text]);
      if (measureSizes) measure(text.assignedSlot ?? host);
      yield;
    }

    const options = this.textOptions;
    for (const nodesOfString of strings.values()) {
      const originals = nodesOfString.map((node) => this.ledger.originalText(node));
      if (!originals.some(hasLetters)) continue;
      plan.strings.push({
        nodes: nodesOfString,
        seen: nodesOfString.map((node) => node.data),
        values: stressParts(originals, options),
      });
      yield;
    }
    for (const { element, name } of attributeTargets) {
      if (measureSizes) measure(element);
      const original = this.ledger.originalAttribute(element, name) ?? '';
      plan.attributes.push({
        element,
        name,
        seen: element.getAttribute(name) ?? '',
        value: stressParts([original], options)[0] ?? original,
      });
      yield;
    }
  }

  // ── Commit ────────────────────────────────────────────────────────────────

  private commit(plan: {
    strings: PlannedString[];
    attributes: PlannedAttribute[];
  }): Omit<StressStats, keyof SliceTiming> {
    const stats = { strings: 0, textNodes: 0, placeholders: 0, buttonValues: 0, growth: 1 };
    let before = 0;
    let after = 0;

    for (const planned of plan.strings) {
      let wrote = false;
      for (const [index, node] of planned.nodes.entries()) {
        const value = planned.values[index];
        if (value === undefined || node.data !== planned.seen[index]) continue;
        const original = this.ledger.originalText(node);
        before += textLength([original]);
        after += textLength([value]);
        if (value === original) continue;
        this.ledger.writeText(node, value);
        stats.textNodes += 1;
        wrote = true;
      }
      if (wrote) stats.strings += 1;
    }
    for (const { element, name, seen, value } of plan.attributes) {
      if ((element.getAttribute(name) ?? '') !== seen) continue;
      before += textLength([this.ledger.originalAttribute(element, name) ?? '']);
      after += textLength([value]);
      this.ledger.writeAttribute(element, name, value);
      stats.strings += 1;
      if (name === 'placeholder') stats.placeholders += 1;
      else stats.buttonValues += 1;
    }
    if (this.options.rtl) this.ledger.writeAttribute(this.doc.documentElement, 'dir', 'rtl');

    stats.growth = before > 0 ? Math.round((after / before) * 100) / 100 : 1;
    return stats;
  }

  // ── Watching for page changes ─────────────────────────────────────────────

  /** Watches every root that holds stress text; safe to call again after a re-apply. */
  private startObserving(): void {
    if (!this.applied) return;
    let observer = this.observer;
    if (!observer) {
      // The page's own MutationObserver, so it works across realms (frames, tests).
      const view = windowOf(this.doc) as Window & typeof globalThis;
      observer = new view.MutationObserver((records) => {
        for (const record of records) {
          for (const added of record.addedNodes) this.trackAdded(added);
        }
        this.notify();
      });
      this.observer = observer;
    }
    for (const root of this.roots) {
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: OBSERVED_ATTRIBUTES,
      });
    }
  }

  /** Remembers stressable text the page added, so it counts as pending. */
  private trackAdded(node: Node): void {
    const { scope } = this.options;
    if (scope && !scope.contains(node)) return;
    if (!this.isStressableParent(node.parentNode)) return;
    if (node.nodeType === TEXT_NODE) {
      if (hasLetters((node as Text).data)) this.fresh.add(node as Text);
      return;
    }
    if (!isElement(node)) return;
    for (const inner of walkTree(this.doc, node, SHOW_TEXT, this.options, {
      skip: isUntouchable,
    })) {
      if (hasLetters((inner as Text).data)) this.fresh.add(inner as Text);
    }
  }

  /**
   * False inside subtrees that are never stressed: `<style>` text injected by
   * CSS-in-JS, scripts, editable regions, ignored UI, and so on.
   */
  private isStressableParent(parent: Node | null): boolean {
    for (let element = isElement(parent) ? parent : null; element; element = flatParent(element)) {
      if (
        SKIPPED_SUBTREES.has(element.localName) ||
        FRAME_TAGS.has(element.localName) ||
        isUntouchable(element) ||
        this.options.ignore?.(element) === true
      ) {
        return false;
      }
    }
    return isElement(parent) || isShadowRoot(parent);
  }

  private notify(): void {
    if (this.listeners.size === 0) return;
    const pending = this.pending();
    if (pending === this.lastPending) return;
    this.lastPending = pending;
    for (const listener of this.listeners) listener(pending);
  }
}
