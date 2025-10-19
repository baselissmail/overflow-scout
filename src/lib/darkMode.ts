/**
 * Dark mode for sidebar panel
 */

const DARK_MODE_KEY = 'overflow-scout-dark-mode';
const DARK_MODE_CLASS = 'overflow-scout-dark-mode';

export function isDarkModeEnabled(): boolean {
  return localStorage.getItem(DARK_MODE_KEY) === 'true';
}

export function setDarkMode(enabled: boolean): void {
  localStorage.setItem(DARK_MODE_KEY, enabled.toString());
  applyDarkMode(enabled);
}

export function toggleDarkMode(): boolean {
  const newState = !isDarkModeEnabled();
  setDarkMode(newState);
  return newState;
}

export function applyDarkMode(enabled: boolean): void {
  const panel = document.getElementById('overflow-scout-results-panel');
  if (!panel) return;

  if (enabled) {
    panel.classList.add(DARK_MODE_CLASS);
  } else {
    panel.classList.remove(DARK_MODE_CLASS);
  }
}

export function injectDarkModeStyles(): void {
  if (document.getElementById('overflow-scout-dark-mode-styles')) return;

  const style = document.createElement('style');
  style.id = 'overflow-scout-dark-mode-styles';
  style.textContent = `
    /* Dark mode for results panel */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} {
      background: #111827 !important;
      color: #f3f4f6 !important;
    }
    
    /* Header in dark mode */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} > div:first-child {
      background: linear-gradient(135deg, #4c51bf 0%, #6b46c1 100%) !important;
    }
    
    /* Content area */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-content-area] {
      background: #111827 !important;
    }
    
    /* Dark mode cards - keep severity border colors! */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-issue-card],
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-manual-card] {
      background: #1f2937 !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
      /* Don't override border-left color - it shows severity! */
      border-right-color: #374151 !important;
      border-top-color: #374151 !important;
      border-bottom-color: #374151 !important;
    }
    
    /* Card text */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-issue-card] > div,
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-manual-card] > div {
      color: #f3f4f6 !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} .selector-text {
      color: #9ca3af !important;
    }
    
    /* Textareas */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} textarea {
      background: #111827 !important;
      border-color: #374151 !important;
      color: #f3f4f6 !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} textarea::placeholder {
      color: #6b7280 !important;
    }
    
    /* Buttons - maintain gradient but adjust for dark mode */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} button {
      transition: all 0.2s ease !important;
    }
    
    /* Copy selector button */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} .copy-selector-btn {
      color: #9ca3af !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} .copy-selector-btn:hover {
      color: #d1d5db !important;
    }
    
    /* Empty state in dark mode */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-empty-state] {
      color: #10b981 !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-empty-state] > div:last-child {
      color: #9ca3af !important;
    }
    
    /* Preset buttons in dark mode */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} button[class*="preset-btn"] {
      background: #111827 !important;
      border-color: #374151 !important;
      color: #60a5fa !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} button[class*="preset-btn"]:hover {
      background: #1f2937 !important;
      border-color: #4b5563 !important;
    }
    
    /* CSS Issues section */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="color: #374151"] {
      color: #d1d5db !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="color: #6b7280"] {
      color: #9ca3af !important;
    }
    
    /* Suggested fixes */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="background: #f3f4f6"] {
      background: #1f2937 !important;
    }
    
    /* Test result messages */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="background: #fef2f2"] {
      background: #7f1d1d !important;
      border-color: #991b1b !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="background: #f0fdf4"] {
      background: #14532d !important;
      border-color: #166534 !important;
    }
  `;
  
  document.head.appendChild(style);
}
