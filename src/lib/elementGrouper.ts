/**
 * Phase 4-6: Element Grouper
 * Groups similar elements for batch testing, including Shadow DOM
 */

import { querySelectorAllDeep } from './shadowDomHelper';

export interface ElementGroup {
  type: 'tag' | 'class' | 'role' | 'elementType';
  selector: string;
  elements: HTMLElement[];
  description: string;
}

/**
 * Find all elements similar to the given element
 */
export function findSimilarElements(element: HTMLElement): ElementGroup[] {
  const groups: ElementGroup[] = [];

  // Group by tag name
  const tagName = element.tagName.toLowerCase();
  const byTag = Array.from(document.querySelectorAll(tagName)) as HTMLElement[];
  if (byTag.length > 1) {
    groups.push({
      type: 'tag',
      selector: tagName,
      elements: byTag,
      description: `All <${tagName}> elements (${byTag.length})`,
    });
  }

  // Group by class (if element has classes)
  const classes = Array.from(element.classList);
  for (const className of classes) {
    const byClass = Array.from(document.querySelectorAll(`.${className}`)) as HTMLElement[];
    if (byClass.length > 1) {
      groups.push({
        type: 'class',
        selector: `.${className}`,
        elements: byClass,
        description: `All .${className} (${byClass.length})`,
      });
    }
  }

  // Group by role
  const role = element.getAttribute('role');
  if (role) {
    const byRole = Array.from(document.querySelectorAll(`[role="${role}"]`)) as HTMLElement[];
    if (byRole.length > 1) {
      groups.push({
        type: 'role',
        selector: `[role="${role}"]`,
        elements: byRole,
        description: `All role="${role}" (${byRole.length})`,
      });
    }
  }

  // Sort by most specific to least specific
  groups.sort((a, b) => a.elements.length - b.elements.length);

  return groups;
}

/**
 * Group all elements of a specific type on the page
 * Phase 6: Now includes Shadow DOM elements
 */
export function groupAllElementsByType(type: 'button' | 'heading' | 'input' | 'link'): ElementGroup | null {
  let selector: string;
  let description: string;

  switch (type) {
    case 'button':
      selector = 'button, [role="button"], input[type="button"], input[type="submit"]';
      description = 'All buttons';
      break;
    case 'heading':
      selector = 'h1, h2, h3, h4, h5, h6';
      description = 'All headings';
      break;
    case 'input':
      selector = 'input[type="text"], input[type="email"], input[type="search"], input[type="tel"], textarea';
      description = 'All text inputs';
      break;
    case 'link':
      selector = 'a[href]';
      description = 'All links';
      break;
    default:
      return null;
  }

  // Phase 6: Use Shadow DOM-aware selector
  const elements = querySelectorAllDeep(selector);

  if (elements.length === 0) {
    return null;
  }

  return {
    type: 'elementType',
    selector,
    elements,
    description: `${description} (${elements.length})`,
  };
}

/**
 * Filter elements that can have text injected
 */
export function filterTextableElements(elements: HTMLElement[]): HTMLElement[] {
  return elements.filter(el => {
    // Phase 7: Skip extension UI elements
    if (el.closest('#overflow-scout-session-banner')) return false;
    if (el.id?.startsWith('overflow-scout-')) return false;
    
    // Skip hidden elements
    if (el.offsetParent === null) return false;

    // Skip tiny elements
    if (el.offsetWidth < 10 || el.offsetHeight < 10) return false;

    // Must have text content or be an input
    const hasText = (el.textContent && el.textContent.trim().length > 0);
    const isInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

    return hasText || isInput;
  });
}

/**
 * Get the best group for batch testing (most specific)
 */
export function getBestGroup(groups: ElementGroup[]): ElementGroup | null {
  if (groups.length === 0) return null;

  // Prefer groups with 2-50 elements (not too small, not too large)
  const ideal = groups.find(g => g.elements.length >= 2 && g.elements.length <= 50);
  if (ideal) return ideal;

  // Otherwise return the smallest group
  return groups[0];
}
