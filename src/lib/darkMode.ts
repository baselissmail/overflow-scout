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
      background: #1f2937 !important;
      color: #f3f4f6 !important;
    }
    
    /* Dark mode cards */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-issue-card],
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-manual-card] {
      background: #374151 !important;
      border-color: #4b5563 !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} .selector-text {
      color: #9ca3af !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} textarea {
      background: #1f2937 !important;
      border-color: #4b5563 !important;
      color: #f3f4f6 !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} button {
      filter: brightness(1.1);
    }
    
    /* Empty state in dark mode */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-empty-state] {
      color: #10b981 !important;
    }
    
    /* Preset buttons in dark mode */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} button[class*="preset-btn"] {
      background: #1f2937 !important;
      border-color: #4b5563 !important;
      color: #60a5fa !important;
    }
  `;
  
  document.head.appendChild(style);
}
