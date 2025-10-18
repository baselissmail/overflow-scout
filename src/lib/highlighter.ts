/**
 * Phase 3: Overflow Highlighter
 * Creates visual overlays and tooltips for detected overflow issues
 */

import { OverflowDetection, OverflowType } from '@/types';

const HIGHLIGHT_CLASS = 'overflow-scout-highlight';
const TOOLTIP_CLASS = 'overflow-scout-tooltip';
const OVERLAY_ID_PREFIX = 'os-overlay-';

/**
 * Create highlight overlay for an element
 */
export function createHighlight(
  element: HTMLElement,
  detection: OverflowDetection,
  originalText: string,
  injectedText: string
): void {
  // Remove existing highlight if present
  removeHighlight(element);

  const rect = element.getBoundingClientRect();
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = HIGHLIGHT_CLASS;
  overlay.id = `${OVERLAY_ID_PREFIX}${getElementId(element)}`;
  
  // Position overlay - Phase 8: Accessibility-safe
  overlay.style.cssText = `
    position: absolute;
    left: ${rect.left + window.scrollX}px;
    top: ${rect.top + window.scrollY}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: 2px solid ${getHighlightColor(detection)};
    background: ${getHighlightBackground(detection)};
    pointer-events: none;
    z-index: 999999;
    border-radius: 4px;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
    transition: all 0.2s ease;
    aria-hidden: true;
  `;
  
  // Phase 8: Accessibility attributes
  overlay.setAttribute('role', 'presentation');
  overlay.setAttribute('aria-hidden', 'true');

  // Create tooltip
  const tooltip = createTooltip(detection, originalText, injectedText);
  overlay.appendChild(tooltip);

  document.body.appendChild(overlay);
  
  // Store reference for cleanup
  element.setAttribute('data-overflow-scout-highlighted', 'true');
}

/**
 * Remove highlight from an element
 */
export function removeHighlight(element: HTMLElement): void {
  const elementId = getElementId(element);
  const overlay = document.getElementById(`${OVERLAY_ID_PREFIX}${elementId}`);
  
  if (overlay) {
    overlay.remove();
  }
  
  element.removeAttribute('data-overflow-scout-highlighted');
}

/**
 * Remove all highlights from the page
 */
export function removeAllHighlights(): void {
  const highlights = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
  highlights.forEach(h => h.remove());
  
  const highlighted = document.querySelectorAll('[data-overflow-scout-highlighted]');
  highlighted.forEach(el => el.removeAttribute('data-overflow-scout-highlighted'));
}

/**
 * Create tooltip with overflow metadata
 */
function createTooltip(
  detection: OverflowDetection,
  originalText: string,
  injectedText: string
): HTMLElement {
  const tooltipHeight = 200;
  
  // Format detected issues
  const issues = detection.types.map(formatOverflowType).join(', ');

  const tooltip = document.createElement('div');
  tooltip.className = TOOLTIP_CLASS;
  tooltip.style.cssText = `
    position: absolute;
    top: -${tooltipHeight}px;
    left: 0;
    background: #1f2937;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-family: monospace;
    white-space: pre-wrap;
    max-width: 400px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    z-index: 1000000;
    line-height: 1.4;
  `;
  
  // Phase 8: Accessibility attributes for tooltip
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('aria-hidden', 'true');
  
  tooltip.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 6px; color: #fca5a5;">
      ⚠️ Overflow Detected
    </div>
    <div style="margin-bottom: 4px;">
      <strong>Issues:</strong> ${issues || 'Unknown'}
    </div>
    <div style="margin-bottom: 4px; font-size: 11px; opacity: 0.9;">
      <strong>Original:</strong> "${truncate(originalText, 40)}"
    </div>
    <div style="font-size: 11px; opacity: 0.9;">
      <strong>Injected:</strong> "${truncate(injectedText, 40)}"
    </div>
    ${detection.details.scrollWidth && detection.details.clientWidth ? `
      <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 11px;">
        Content: ${detection.details.scrollWidth}px → Visible: ${detection.details.clientWidth}px
      </div>
    ` : ''}
  `;

  return tooltip;
}

/**
 * Get highlight color based on severity
 */
function getHighlightColor(detection: OverflowDetection): string {
  if (detection.types.includes(OverflowType.CLIPPING)) {
    return '#ef4444'; // Red - severe
  }
  if (detection.types.includes(OverflowType.LINE_CLAMP)) {
    return '#f97316'; // Orange - moderate
  }
  if (detection.types.includes(OverflowType.ELLIPSIS)) {
    return '#eab308'; // Yellow - minor
  }
  return '#3b82f6'; // Blue - info
}

/**
 * Get highlight background based on severity
 */
function getHighlightBackground(detection: OverflowDetection): string {
  if (detection.types.includes(OverflowType.CLIPPING)) {
    return 'rgba(239, 68, 68, 0.1)'; // Red tint
  }
  if (detection.types.includes(OverflowType.LINE_CLAMP)) {
    return 'rgba(249, 115, 22, 0.1)'; // Orange tint
  }
  return 'rgba(59, 130, 246, 0.05)'; // Blue tint
}

/**
 * Format overflow type for display
 */
function formatOverflowType(type: OverflowType): string {
  switch (type) {
    case OverflowType.CLIPPING:
      return 'Clipping';
    case OverflowType.ELLIPSIS:
      return 'Ellipsis (...)';
    case OverflowType.LINE_CLAMP:
      return 'Line Clamp';
    case OverflowType.WRAPPING:
      return 'Text Wrapping';
    case OverflowType.SCROLLABLE:
      return 'Scrollable';
    default:
      return 'Unknown';
  }
}

/**
 * Truncate text for display
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Get element ID (from data attribute)
 */
function getElementId(element: HTMLElement): string {
  return element.getAttribute('data-overflow-scout-id') || '';
}
