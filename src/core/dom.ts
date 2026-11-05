/**
 * Realm-safe DOM helpers. Pages, iframes and shadow roots each come with their
 * own globals, so `instanceof HTMLElement` and the global `window`/`document`
 * are unreliable here. These helpers use node types and namespaces instead.
 */

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
export const DOCUMENT_NODE = 9;
export const DOCUMENT_FRAGMENT_NODE = 11;

/** NodeFilter constants (numeric so `core` runs without DOM globals). */
export const SHOW_ELEMENT = 0x1;
export const SHOW_TEXT = 0x4;
export const FILTER_ACCEPT = 1;
export const FILTER_REJECT = 2;

const HTML_NS = 'http://www.w3.org/1999/xhtml';

export function isElement(node: Node | null | undefined): node is Element {
  return node?.nodeType === ELEMENT_NODE;
}

export function isHtmlElement(node: Node | null | undefined): node is HTMLElement {
  return isElement(node) && node.namespaceURI === HTML_NS;
}

export function isShadowRoot(node: Node | null | undefined): node is ShadowRoot {
  return node?.nodeType === DOCUMENT_FRAGMENT_NODE && 'host' in node;
}

export function isInput(element: Element): element is HTMLInputElement {
  return isHtmlElement(element) && element.localName === 'input';
}

/** `<html>` and `<body>` hand their overflow to the viewport instead of clipping. */
export function isRootElement(element: Element): boolean {
  return element.localName === 'html' || element.localName === 'body';
}

/**
 * Parent in the flat tree, the tree that is actually rendered: slotted nodes
 * belong to their slot, and shadow roots belong to their host.
 */
export function flatParent(node: Element | Text): Element | null {
  const slot = node.assignedSlot;
  if (slot) return slot;
  const parent = node.parentNode;
  if (isElement(parent)) return parent;
  if (isShadowRoot(parent)) return parent.host;
  return null;
}

export function windowOf(doc: Document): Window {
  const view = doc.defaultView;
  if (!view) throw new Error('Overflow Scout: the document is not attached to a window');
  return view;
}

/** Collapses whitespace and shortens text for display. */
export function sampleText(text: string, max = 120): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}
