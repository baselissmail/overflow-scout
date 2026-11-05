import {
  attr as wordLikeAttr,
  className as wordLikeClass,
  finder,
  idName as wordLikeId,
} from '@medv/finder';

import { flatParent, isShadowRoot } from '../dom';
import { isGeneratedName, stableClasses } from '../group/fingerprint';

export interface ElementDescription {
  /**
   * A unique CSS selector. Inside shadow DOM, the host and inner selectors are
   * joined with Playwright's ` >> ` chaining, so the result works in tests.
   */
  selector: string;
  /** Short human-readable path, e.g. `nav › li › a.nav-link`. */
  label: string;
}

const TEST_ATTRIBUTES = new Set(['data-testid', 'data-test', 'data-cy', 'data-qa']);
const USEFUL_ATTRIBUTES = new Set([...TEST_ATTRIBUTES, 'name', 'aria-label', 'role']);

function uniqueSelector(element: Element): string {
  const root = element.getRootNode();
  try {
    return finder(element, {
      // finder accepts any node with querySelectorAll; documents and shadow roots both work.
      root: root as unknown as Element,
      idName: (name) => wordLikeId(name) && !isGeneratedName(name),
      className: (name) => wordLikeClass(name) && !isGeneratedName(name),
      attr: (name, value) =>
        USEFUL_ATTRIBUTES.has(name) && value.length <= 40 && wordLikeAttr(name, value),
      timeoutMs: 50,
    });
  } catch {
    return element.localName;
  }
}

function segment(element: Element): string {
  const [first] = stableClasses(Array.from(element.classList));
  return first ? `${element.localName}.${first}` : element.localName;
}

/**
 * A unique CSS selector for the element. Inside shadow DOM, the host and inner
 * selectors are joined with Playwright's ` >> ` chaining. Costs up to ~50 ms
 * on complex pages, so compute it only for elements someone looks at.
 */
export function elementSelector(element: Element): string {
  const root = element.getRootNode();
  const inner = uniqueSelector(element);
  return isShadowRoot(root) ? `${elementSelector(root.host)} >> ${inner}` : inner;
}

/** Short human-readable path, e.g. `nav › li › a.nav-link`. Cheap. */
export function elementLabel(element: Element): string {
  const parts: string[] = [];
  for (
    let current: Element | null = element;
    current && parts.length < 3;
    current = flatParent(current)
  ) {
    if (current.localName === 'body' || current.localName === 'html') break;
    if (current.localName !== 'slot') parts.unshift(segment(current));
  }
  return parts.join(' › ');
}

/** Describes an element for reports and test selectors. */
export function describeElement(element: Element): ElementDescription {
  return { selector: elementSelector(element), label: elementLabel(element) };
}
