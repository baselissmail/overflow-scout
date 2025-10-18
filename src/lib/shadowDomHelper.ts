/**
 * Phase 6: Shadow DOM Helper
 * Utilities for traversing and working with Shadow DOM
 */

import { Logger } from '@/types';

/**
 * Check if an element has an open shadow root
 */
export function hasShadowRoot(element: Element): boolean {
  return element.shadowRoot !== null;
}

/**
 * Get all elements including those in shadow DOM
 */
export function querySelectorAllDeep(selector: string, root: Document | Element | ShadowRoot = document): HTMLElement[] {
  const results: HTMLElement[] = [];

  // Query in light DOM
  const lightElements = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
  results.push(...lightElements);

  // Query in shadow DOMs
  const allElements = Array.from(root.querySelectorAll('*'));
  for (const element of allElements) {
    if (element.shadowRoot) {
      const shadowElements = querySelectorAllDeep(selector, element.shadowRoot);
      results.push(...shadowElements);
    }
  }

  return results;
}

/**
 * Find element by selector, including shadow DOM
 */
export function querySelectorDeep(selector: string, root: Document | Element | ShadowRoot = document): HTMLElement | null {
  // Try light DOM first
  const lightElement = root.querySelector(selector) as HTMLElement | null;
  if (lightElement) return lightElement;

  // Search shadow DOMs
  const allElements = Array.from(root.querySelectorAll('*'));
  for (const element of allElements) {
    if (element.shadowRoot) {
      const shadowElement = querySelectorDeep(selector, element.shadowRoot);
      if (shadowElement) return shadowElement;
    }
  }

  return null;
}

/**
 * Get all text-bearing elements including shadow DOM
 */
export function getAllTextElements(root: Document | Element | ShadowRoot = document): HTMLElement[] {
  const elements: HTMLElement[] = [];

  // Get all elements in light DOM
  const allElements = Array.from(root.querySelectorAll('*'));
  
  for (const element of allElements) {
    const htmlElement = element as HTMLElement;
    
    // Add if it has text content
    if (htmlElement.textContent && htmlElement.textContent.trim()) {
      elements.push(htmlElement);
    }

    // Recurse into shadow DOM
    if (element.shadowRoot) {
      const shadowElements = getAllTextElements(element.shadowRoot);
      elements.push(...shadowElements);
    }
  }

  return elements;
}

/**
 * Find shadow host for an element (if it's in shadow DOM)
 */
export function findShadowHost(element: Node): Element | null {
  const root = element.getRootNode();
  
  if (root instanceof ShadowRoot) {
    return root.host;
  }
  
  return null;
}

/**
 * Check if element is in shadow DOM
 */
export function isInShadowDOM(element: Node): boolean {
  return element.getRootNode() instanceof ShadowRoot;
}

/**
 * Get path to element including shadow DOM boundaries
 */
export function getElementPath(element: Element): string {
  const parts: string[] = [];
  let current: Node | null = element;

  while (current && current !== document) {
    if (current instanceof Element) {
      const tagName = current.tagName.toLowerCase();
      const id = current.id ? `#${current.id}` : '';
      const classes = current.className ? `.${current.className.split(' ').join('.')}` : '';
      parts.unshift(`${tagName}${id}${classes}`);
    }

    // Check if we're crossing a shadow boundary
    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      parts.unshift('::shadow-root');
      current = root.host;
    } else {
      current = current.parentNode;
    }
  }

  return parts.join(' > ');
}

/**
 * Count total shadow roots in document
 */
export function countShadowRoots(root: Document | Element | ShadowRoot = document): number {
  let count = 0;
  const allElements = Array.from(root.querySelectorAll('*'));
  
  for (const element of allElements) {
    if (element.shadowRoot) {
      count++;
      count += countShadowRoots(element.shadowRoot);
    }
  }
  
  return count;
}

/**
 * Log shadow DOM structure for debugging
 */
export function logShadowDOMStructure(): void {
  const count = countShadowRoots();
  Logger.info(`Found ${count} shadow root(s) in document`);
  
  if (count > 0) {
    const hosts = Array.from(document.querySelectorAll('*'));
    for (const host of hosts) {
      if (host.shadowRoot) {
        Logger.debug('Shadow host:', host.tagName, host.className);
      }
    }
  }
}
