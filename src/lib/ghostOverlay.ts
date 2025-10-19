/**
 * Phase 9: Ghost Overlay
 * Non-destructive visual testing using CSS ::after pseudo-elements
 */

const GHOST_CLASS = 'os-ghost';
const GHOST_WRAP_CLASS = 'os-wrap-ghost';

/**
 * Inject CSS for ghost overlays
 */
export function injectGhostStyles(): void {
  if (document.getElementById('overflow-scout-ghost-styles')) {
    return; // Already injected
  }

  const style = document.createElement('style');
  style.id = 'overflow-scout-ghost-styles';
  style.textContent = `
    .${GHOST_CLASS} {
      position: relative !important;
    }
    
    .${GHOST_CLASS}::after {
      content: var(--os-text) !important;
      position: absolute !important;
      inset: 0 !important;
      white-space: nowrap !important;
      pointer-events: none !important;
      opacity: 0.35 !important;
      color: #ef4444 !important;
      font-weight: 600 !important;
      z-index: 1 !important;
      overflow: visible !important;
    }
    
    .${GHOST_WRAP_CLASS}::after {
      white-space: normal !important;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Apply ghost overlay to element
 */
export function applyGhostOverlay(
  element: HTMLElement,
  testText: string,
  allowWrap: boolean = false
): void {
  // Inject styles if not already present
  injectGhostStyles();
  
  // Escape quotes in text
  const escaped = testText.replace(/"/g, '\\"');
  
  // Apply ghost overlay
  element.classList.add(GHOST_CLASS);
  if (allowWrap) {
    element.classList.add(GHOST_WRAP_CLASS);
  }
  
  element.style.setProperty('--os-text', `"${escaped}"`);
  element.setAttribute('data-os-ghost', 'true');
}

/**
 * Remove ghost overlay from element
 */
export function removeGhostOverlay(element: HTMLElement): void {
  element.classList.remove(GHOST_CLASS, GHOST_WRAP_CLASS);
  element.style.removeProperty('--os-text');
  element.removeAttribute('data-os-ghost');
}

/**
 * Check if element has ghost overlay
 */
export function hasGhostOverlay(element: HTMLElement): boolean {
  return element.hasAttribute('data-os-ghost');
}

/**
 * Remove all ghost overlays from page
 */
export function removeAllGhostOverlays(): void {
  const ghostElements = document.querySelectorAll(`[data-os-ghost]`);
  ghostElements.forEach(el => {
    if (el instanceof HTMLElement) {
      removeGhostOverlay(el);
    }
  });
}
