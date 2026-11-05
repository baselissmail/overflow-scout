import { FILTER_ACCEPT, FILTER_REJECT, SHOW_ELEMENT, isElement } from './dom';
import type { TraversalOptions } from './types';

/** Subtrees that don't render page text we can measure. */
export const SKIPPED_SUBTREES: ReadonlySet<string> = new Set([
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

/** Embedded documents are not scanned in v1 (plan §1.4). */
export const FRAME_TAGS: ReadonlySet<string> = new Set(['iframe', 'frame', 'object', 'embed']);

export interface TraversalHooks {
  /** Called for every frame left out. */
  onFrame?: (element: Element) => void;
  /** Called for every shadow root entered. */
  onShadowRoot?: (root: ShadowRoot) => void;
  /** Called for every element left out because of its tag (`textarea`, `select`, ...). */
  onSkippedTag?: (element: Element) => void;
  /** Extra subtrees to leave out. */
  skip?: (element: Element) => boolean;
}

export function shadowRootOf(element: Element, options: TraversalOptions): ShadowRoot | null {
  return element.shadowRoot ?? options.openShadowRoot?.(element) ?? null;
}

/**
 * Walks the rendered (flat) tree in document order: elements and/or text
 * nodes, descending into open shadow roots and, through `openShadowRoot`,
 * closed ones. When `root` is an element it is visited first.
 */
export function* walkTree(
  doc: Document,
  root: Document | ShadowRoot | Element,
  show: number,
  options: TraversalOptions,
  hooks: TraversalHooks = {},
): Generator<Node> {
  const rejects = (element: Element) =>
    FRAME_TAGS.has(element.localName) ||
    SKIPPED_SUBTREES.has(element.localName) ||
    options.ignore?.(element) === true ||
    hooks.skip?.(element) === true;

  const showElements = (show & SHOW_ELEMENT) !== 0;
  if (isElement(root)) {
    if (rejects(root)) return;
    // TreeWalker never returns its root, so visit it here.
    if (showElements) yield root;
    const shadow = shadowRootOf(root, options);
    if (shadow) {
      hooks.onShadowRoot?.(shadow);
      yield* walkTree(doc, shadow, show, options, hooks);
    }
  }

  // Elements are always walked so that skipped subtrees are rejected as a whole.
  const walker = doc.createTreeWalker(root, show | SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (!isElement(node)) return FILTER_ACCEPT;
      if (FRAME_TAGS.has(node.localName)) {
        hooks.onFrame?.(node);
        return FILTER_REJECT;
      }
      if (rejects(node)) {
        if (SKIPPED_SUBTREES.has(node.localName)) hooks.onSkippedTag?.(node);
        return FILTER_REJECT;
      }
      return FILTER_ACCEPT;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!isElement(node)) {
      yield node;
      continue;
    }
    if (showElements) yield node;
    const shadow = shadowRootOf(node, options);
    if (shadow) {
      hooks.onShadowRoot?.(shadow);
      yield* walkTree(doc, shadow, show, options, hooks);
    }
  }
}
