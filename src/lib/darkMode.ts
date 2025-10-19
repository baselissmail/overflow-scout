/**
 * Dark mode for sidebar panel - Highest UI/UX Standards
 * - WCAG AAA compliant contrast ratios
 * - Smooth transitions
 * - System preference detection
 * - Consistent theming
 */

const DARK_MODE_KEY = 'overflow-scout-dark-mode';
const DARK_MODE_CLASS = 'overflow-scout-dark-mode';

/**
 * Detect system dark mode preference
 */
function getSystemPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Check if dark mode is enabled (from chrome.storage or system default)
 */
export async function isDarkModeEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['overflowScoutDarkMode'], (result) => {
        if (result.overflowScoutDarkMode === undefined) {
          resolve(getSystemPreference());
        } else {
          resolve(result.overflowScoutDarkMode);
        }
      });
    } else {
      // Fallback for non-extension contexts
      const stored = localStorage.getItem(DARK_MODE_KEY);
      resolve(stored === null ? getSystemPreference() : stored === 'true');
    }
  });
}

/**
 * Synchronous version for immediate checks
 */
export function isDarkModeEnabledSync(): boolean {
  const stored = localStorage.getItem(DARK_MODE_KEY);
  if (stored === null) {
    return getSystemPreference();
  }
  return stored === 'true';
}

export function setDarkMode(enabled: boolean): void {
  // Save to both localStorage and chrome.storage
  localStorage.setItem(DARK_MODE_KEY, enabled.toString());
  
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ overflowScoutDarkMode: enabled });
  }
  
  applyDarkMode(enabled);
}

export function toggleDarkMode(): boolean {
  const newState = !isDarkModeEnabledSync();
  setDarkMode(newState);
  return newState;
}

export function applyDarkMode(enabled: boolean): void {
  const panel = document.getElementById('overflow-scout-results-panel');
  if (!panel) return;

  // Add transition class for smooth theme switching
  panel.style.transition = 'background-color 0.2s ease, color 0.2s ease';
  
  if (enabled) {
    panel.classList.add(DARK_MODE_CLASS);
  } else {
    panel.classList.remove(DARK_MODE_CLASS);
  }
  
  // Remove transition after animation completes
  setTimeout(() => {
    panel.style.transition = '';
  }, 200);
}

export function injectDarkModeStyles(): void {
  if (document.getElementById('overflow-scout-dark-mode-styles')) return;

  const style = document.createElement('style');
  style.id = 'overflow-scout-dark-mode-styles';
  
  // Listen for system theme changes
  if (window.matchMedia) {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', (e) => {
      // Only apply if user hasn't set manual preference
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['overflowScoutDarkMode'], (result) => {
          if (result.overflowScoutDarkMode === undefined) {
            setDarkMode(e.matches);
          }
        });
      }
    });
  }
  style.textContent = `
    /* ============================================
       DARK MODE - WCAG AAA COMPLIANT
       ============================================ */
    
    /* Panel background and text */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} {
      background: #0f172a !important; /* slate-900 */
      color: #f1f5f9 !important; /* slate-100 - 14.6:1 contrast */
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    /* Smooth transitions for theme switch */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} * {
      transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    }
    
    /* Header in dark mode */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} > div:first-child {
      background: linear-gradient(135deg, #4338ca 0%, #7c3aed 100%) !important; /* Richer purples */
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
    }
    
    /* Content area */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-content-area] {
      background: #0f172a !important;
    }
    
    /* Cards in dark mode - keep severity borders visible */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-issue-card],
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-manual-card] {
      background: #1e293b !important; /* slate-800 */
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2) !important;
      /* Don't override border-left color - it shows severity! */
      border-right-color: #475569 !important; /* slate-600 */
      border-top-color: #475569 !important;
      border-bottom-color: #475569 !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-issue-card]:hover,
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-manual-card]:hover {
      background: #293548 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3) !important;
    }
    
    /* Card text - optimal readability (exclude test-result) */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-issue-card] > div:not(.test-result),
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-manual-card] > div:not(.test-result) {
      color: #f1f5f9 !important; /* slate-100 */
      font-weight: 500 !important;
    }
    
    /* Selector text - monospace with good contrast */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} .selector-text {
      color: #cbd5e1 !important; /* slate-300 - 8.5:1 contrast */
      font-weight: 400 !important;
      letter-spacing: 0.01em !important;
    }
    
    /* Small text - improved weight and spacing for crisp rendering */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="font-size: 11px"],
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="font-size: 12px"],
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="font-size: 10px"] {
      font-weight: 500 !important;
      letter-spacing: 0.015em !important;
    }
    
    /* Blue accent colors - WCAG AAA compliant */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="color: #2563eb"]:not(.test-result):not(.test-result *),
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="color: #3b82f6"]:not(.test-result):not(.test-result *) {
      color: #93c5fd !important; /* blue-300 - 8.6:1 contrast */
    }
    
    /* Headings - maximum contrast and readability */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="color: #111827"]:not(.test-result):not(.test-result *) {
      color: #f8fafc !important; /* slate-50 - 16:1 contrast */
      font-weight: 600 !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="color: #374151"]:not(.test-result):not(.test-result *) {
      color: #e2e8f0 !important; /* slate-200 - 12:1 contrast */
      font-weight: 500 !important;
    }
    
    /* Gray text hierarchy - all meeting WCAG AAA */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="color: #6b7280"]:not(.test-result):not(.test-result *) {
      color: #cbd5e1 !important; /* slate-300 - 8.5:1 */
      font-weight: 400 !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="color: #9ca3af"]:not(.test-result):not(.test-result *) {
      color: #e2e8f0 !important; /* slate-200 - 12:1 */
      font-weight: 400 !important;
    }
    
    /* Textareas and inputs */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} textarea,
    #overflow-scout-results-panel.${DARK_MODE_CLASS} input[type="text"] {
      background: #1e293b !important; /* slate-800 */
      border-color: #475569 !important; /* slate-600 */
      color: #f1f5f9 !important; /* slate-100 */
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} textarea:focus,
    #overflow-scout-results-panel.${DARK_MODE_CLASS} input[type="text"]:focus {
      background: #0f172a !important;
      border-color: #818cf8 !important; /* indigo-400 */
      box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.1) !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} textarea::placeholder,
    #overflow-scout-results-panel.${DARK_MODE_CLASS} input::placeholder {
      color: #94a3b8 !important; /* slate-400 */
    }
    
    /* Buttons - improved states */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} button {
      transition: all 0.15s ease !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} button:not([disabled]):hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} button:not([disabled]):active {
      transform: translateY(0);
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
    
    /* Preset buttons - clear visual hierarchy */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} button[class*="preset-btn"] {
      background: #1e293b !important; /* slate-800 */
      border-color: #475569 !important; /* slate-600 */
      color: #93c5fd !important; /* blue-300 */
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} button[class*="preset-btn"]:hover {
      background: #334155 !important; /* slate-700 */
      border-color: #60a5fa !important; /* blue-400 */
      color: #bfdbfe !important; /* blue-200 */
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} button[class*="preset-btn"]:active {
      background: #0f172a !important;
    }
    
    /* Suggested fixes - code blocks */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="background: #f3f4f6"],
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="background: white"] {
      background: #1e293b !important; /* slate-800 */
      border-color: #475569 !important;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="background: #eff6ff"] {
      background: #1e3a5f !important; /* blue-tinted dark bg */
      border-color: #3b82f6 !important;
    }
    
    /* Test result messages - semantic colors preserved */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="background: #fef2f2"] {
      background: #7f1d1d !important; /* red-900 */
      border-color: #dc2626 !important; /* red-600 */
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [style*="background: #f0fdf4"] {
      background: #14532d !important; /* green-900 */
      border-color: #22c55e !important; /* green-500 */
    }
    
    /* Test result colors - keep ALL original light mode colors */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} .test-result,
    #overflow-scout-results-panel.${DARK_MODE_CLASS} .test-result * {
      /* Don't override any colors in test results - preserve semantic meaning */
    }
    
    /* Empty state */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-empty-state] {
      color: #6ee7b7 !important; /* emerald-300 */
    }
    
    /* Scrollbar styling for dark mode */
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-content-area]::-webkit-scrollbar {
      width: 8px;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-content-area]::-webkit-scrollbar-track {
      background: #0f172a;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-content-area]::-webkit-scrollbar-thumb {
      background: #475569;
      border-radius: 4px;
    }
    
    #overflow-scout-results-panel.${DARK_MODE_CLASS} [data-content-area]::-webkit-scrollbar-thumb:hover {
      background: #64748b;
    }
  `;
  
  document.head.appendChild(style);
}
