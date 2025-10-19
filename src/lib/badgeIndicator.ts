/**
 * Phase 9: Badge Indicator
 * Small corner badge for overflow detection (non-intrusive)
 */

const BADGE_CLASS = 'os-badge';
const BADGE_ID_PREFIX = 'os-badge-';

/**
 * Inject badge styles
 */
export function injectBadgeStyles(): void {
  if (document.getElementById('overflow-scout-badge-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'overflow-scout-badge-styles';
  style.textContent = `
    .${BADGE_CLASS} {
      position: absolute !important;
      top: -8px !important;
      right: -8px !important;
      background: #ef4444 !important;
      color: white !important;
      border-radius: 12px !important;
      padding: 2px 6px !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      z-index: 999999 !important;
      pointer-events: auto !important;
      cursor: pointer !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
      line-height: 1 !important;
      white-space: nowrap !important;
    }
    
    .${BADGE_CLASS}:hover {
      background: #dc2626 !important;
      transform: scale(1.1) !important;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Create badge for element
 */
export function createBadge(element: HTMLElement, issueType: string): void {
  injectBadgeStyles();
  
  // Make sure element has position context
  const position = window.getComputedStyle(element).position;
  if (position === 'static') {
    element.style.position = 'relative';
  }
  
  const badge = document.createElement('div');
  badge.className = BADGE_CLASS;
  badge.id = `${BADGE_ID_PREFIX}${getElementId(element)}`;
  badge.textContent = '⚠️';
  badge.title = `Overflow: ${issueType}`;
  badge.setAttribute('aria-label', `Overflow detected: ${issueType}`);
  badge.setAttribute('role', 'status');
  
  // Click to show details
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    showBadgeDetails(element, issueType);
  });
  
  element.appendChild(badge);
  element.setAttribute('data-os-badge', 'true');
}

/**
 * Remove badge from element
 */
export function removeBadge(element: HTMLElement): void {
  const badge = element.querySelector(`#${BADGE_ID_PREFIX}${getElementId(element)}`);
  if (badge) {
    badge.remove();
  }
  element.removeAttribute('data-os-badge');
}

/**
 * Show badge details (simple alert for now)
 */
function showBadgeDetails(element: HTMLElement, _issueType: string): void {
  // For now, just highlight the element
  element.style.outline = '2px solid #ef4444';
  element.style.outlineOffset = '2px';
  
  setTimeout(() => {
    element.style.outline = '';
    element.style.outlineOffset = '';
  }, 2000);
}

/**
 * Get element ID
 */
function getElementId(element: HTMLElement): string {
  return element.getAttribute('data-overflow-scout-id') || '';
}

/**
 * Remove all badges
 */
export function removeAllBadges(): void {
  const badges = document.querySelectorAll(`[data-os-badge]`);
  badges.forEach(el => {
    if (el instanceof HTMLElement) {
      removeBadge(el);
    }
  });
}
