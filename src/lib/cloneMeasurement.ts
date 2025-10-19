/**
 * Phase 9: Clone Measurement
 * Detect overflow without modifying the actual DOM
 */

import { ElementType } from '@/types';

/**
 * Measure overflow using a hidden clone
 * Returns true if overflow detected
 */
export function measureWithClone(
  element: HTMLElement,
  testText: string,
  elementType: ElementType
): boolean {
  // Create clone
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Position off-screen and hide
  clone.style.cssText = window.getComputedStyle(element).cssText + 
    ';position:fixed!important;left:-9999px!important;top:-9999px!important;visibility:hidden!important;';
  
  // Remove any existing overflow scout attributes
  clone.removeAttribute('data-overflow-scout-id');
  clone.removeAttribute('data-overflow-scout-highlighted');
  
  // Set the test text
  setTextOnClone(clone, testText, elementType);
  
  // Append to body
  document.body.appendChild(clone);
  
  // Measure overflow
  const hasOverflow = clone.scrollWidth > clone.clientWidth || 
                      clone.scrollHeight > clone.clientHeight;
  
  // Clean up
  clone.remove();
  
  return hasOverflow;
}

/**
 * Set text on clone element
 */
function setTextOnClone(
  element: HTMLElement,
  text: string,
  type: ElementType
): void {
  if (type === ElementType.INPUT || type === ElementType.TEXTAREA) {
    (element as HTMLInputElement | HTMLTextAreaElement).value = text;
  } else if (type === ElementType.PLACEHOLDER) {
    (element as HTMLInputElement).placeholder = text;
  } else if (type === ElementType.ARIA_LABEL) {
    element.setAttribute('aria-label', text);
  } else {
    element.textContent = text;
  }
}

/**
 * Check if element is in viewport (with buffer)
 */
export function isInViewport(element: HTMLElement, buffer: number = 200): boolean {
  const rect = element.getBoundingClientRect();
  
  return (
    rect.top < (window.innerHeight || document.documentElement.clientHeight) + buffer &&
    rect.bottom > -buffer &&
    rect.left < (window.innerWidth || document.documentElement.clientWidth) + buffer &&
    rect.right > -buffer
  );
}

/**
 * Filter elements to only those in viewport
 */
export function filterViewportElements(elements: HTMLElement[], buffer: number = 200): HTMLElement[] {
  return elements.filter(el => isInViewport(el, buffer));
}

/**
 * Sample elements (take percentage)
 */
export function sampleElements(elements: HTMLElement[], percentage: number = 20): HTMLElement[] {
  if (elements.length <= 10) {
    return elements; // Test all if small set
  }
  
  const sampleSize = Math.max(8, Math.ceil(elements.length * (percentage / 100)));
  const step = Math.floor(elements.length / sampleSize);
  
  const sampled: HTMLElement[] = [];
  for (let i = 0; i < elements.length && sampled.length < sampleSize; i += step) {
    sampled.push(elements[i]);
  }
  
  return sampled;
}
