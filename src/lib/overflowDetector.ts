/**
 * Phase 3: Overflow Detection Engine
 * Detects various types of overflow issues in elements
 */

import { OverflowDetection, OverflowType } from '@/types';

/**
 * Detect all overflow issues in an element
 */
export function detectOverflow(element: HTMLElement): OverflowDetection {
  const types: OverflowType[] = [];
  const computed = window.getComputedStyle(element);

  // Get dimensions
  const scrollWidth = element.scrollWidth;
  const clientWidth = element.clientWidth;
  const scrollHeight = element.scrollHeight;
  const clientHeight = element.clientHeight;

  // Check for horizontal clipping
  const isClippedH = scrollWidth > clientWidth;
  const isClippedV = scrollHeight > clientHeight;
  const isClipped = isClippedH || isClippedV;

  // Check for ellipsis
  const hasEllipsis = computed.textOverflow === 'ellipsis' && isClipped;

  // Check for line-clamp
  const lineClampValue = computed.webkitLineClamp;
  const hasLineClamp = lineClampValue !== 'none' && lineClampValue !== '';

  // Check for wrapping
  const whiteSpace = computed.whiteSpace;
  const isWrapping = whiteSpace === 'normal' || whiteSpace === 'pre-wrap';

  // Check for scrollable overflow
  const overflowX = computed.overflowX;
  const overflowY = computed.overflowY;
  const isScrollable = 
    (overflowX === 'scroll' || overflowX === 'auto') ||
    (overflowY === 'scroll' || overflowY === 'auto');

  // Determine overflow types
  if (isClipped && !hasEllipsis && !isScrollable) {
    types.push(OverflowType.CLIPPING);
  }

  if (hasEllipsis) {
    types.push(OverflowType.ELLIPSIS);
  }

  if (hasLineClamp) {
    types.push(OverflowType.LINE_CLAMP);
  }

  if (isWrapping && scrollHeight > clientHeight) {
    types.push(OverflowType.WRAPPING);
  }

  if (isScrollable && isClipped) {
    types.push(OverflowType.SCROLLABLE);
  }

  if (types.length === 0) {
    types.push(OverflowType.NONE);
  }

  const hasOverflow = types.some(t => t !== OverflowType.NONE);

  return {
    hasOverflow,
    types,
    details: {
      isClipped,
      hasEllipsis,
      hasLineClamp,
      isWrapping,
      isScrollable,
      scrollWidth,
      clientWidth,
      scrollHeight,
      clientHeight,
      computedStyle: {
        overflow: computed.overflow,
        overflowX: computed.overflowX,
        overflowY: computed.overflowY,
        textOverflow: computed.textOverflow,
        whiteSpace: computed.whiteSpace,
        webkitLineClamp: computed.webkitLineClamp,
      },
    },
  };
}

/**
 * Check if element has any overflow issues (quick check)
 */
export function hasOverflow(element: HTMLElement): boolean {
  return (
    element.scrollWidth > element.clientWidth ||
    element.scrollHeight > element.clientHeight
  );
}

/**
 * Get severity level of overflow (for prioritization)
 */
export function getOverflowSeverity(detection: OverflowDetection): 'high' | 'medium' | 'low' | 'none' {
  if (!detection.hasOverflow) return 'none';

  if (detection.types.includes(OverflowType.CLIPPING)) {
    return 'high'; // Content is being cut off - serious issue
  }

  if (detection.types.includes(OverflowType.LINE_CLAMP)) {
    return 'medium'; // Intentional truncation but still worth noting
  }

  if (detection.types.includes(OverflowType.ELLIPSIS)) {
    return 'low'; // Handled gracefully with ellipsis
  }

  return 'low';
}
