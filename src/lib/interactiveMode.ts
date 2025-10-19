/**
 * Interactive Mode - Point & Click Testing
 * Click button to activate, then click elements to test them
 * Double-click to cycle through text variations
 */

const INTERACTIVE_CURSOR_CLASS = 'overflow-scout-interactive-cursor';
const INTERACTIVE_HIGHLIGHT_CLASS = 'overflow-scout-interactive-highlight';

/**
 * Inject styles for interactive mode
 */
export function injectInteractiveModeStyles(): void {
  if (document.getElementById('overflow-scout-interactive-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'overflow-scout-interactive-styles';
  style.textContent = `
    /* Interactive cursor mode */
    body.${INTERACTIVE_CURSOR_CLASS} {
      cursor: crosshair !important;
    }
    
    body.${INTERACTIVE_CURSOR_CLASS} * {
      cursor: crosshair !important;
    }
    
    /* Normal cursor for sidebar - make it fully functional */
    body.${INTERACTIVE_CURSOR_CLASS} #overflow-scout-results-panel,
    body.${INTERACTIVE_CURSOR_CLASS} #overflow-scout-results-panel *,
    body.${INTERACTIVE_CURSOR_CLASS} #overflow-scout-auto-badge,
    body.${INTERACTIVE_CURSOR_CLASS} #overflow-scout-auto-badge * {
      cursor: auto !important;
    }
    
    body.${INTERACTIVE_CURSOR_CLASS} #overflow-scout-results-panel button,
    body.${INTERACTIVE_CURSOR_CLASS} #overflow-scout-results-panel input {
      cursor: pointer !important;
    }
    
    body.${INTERACTIVE_CURSOR_CLASS} #overflow-scout-results-panel input[type="text"] {
      cursor: text !important;
    }
    
    /* Hover highlight */
    .${INTERACTIVE_HIGHLIGHT_CLASS} {
      outline: 2px dashed #3b82f6 !important;
      outline-offset: 2px !important;
      background: rgba(59, 130, 246, 0.05) !important;
    }
    
    /* Active mode indicator banner */
    .overflow-scout-interactive-banner {
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
      color: white !important;
      padding: 12px 20px !important;
      border-radius: 8px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      animation: slideIn 0.3s ease-out !important;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .overflow-scout-interactive-banner-icon {
      font-size: 18px !important;
      line-height: 1 !important;
    }
    
    .overflow-scout-interactive-banner-text {
      line-height: 1.4 !important;
    }
    
    .overflow-scout-interactive-banner-hint {
      font-size: 11px !important;
      opacity: 0.9 !important;
      font-weight: 400 !important;
    }
    
    .overflow-scout-interactive-banner-close {
      background: rgba(255, 255, 255, 0.2) !important;
      border: none !important;
      color: white !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      transition: background 0.2s !important;
    }
    
    .overflow-scout-interactive-banner-close:hover {
      background: rgba(255, 255, 255, 0.3) !important;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Interactive Mode Manager
 */
export class InteractiveModeManager {
  private active = false;
  private banner: HTMLElement | null = null;
  private currentHoverElement: HTMLElement | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private hoverHandler: ((e: MouseEvent) => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  
  // Callback for when element is clicked
  private onElementClick: ((element: HTMLElement, isDoubleClick: boolean) => void) | null = null;

  constructor() {
    injectInteractiveModeStyles();
  }

  /**
   * Activate interactive mode
   */
  activate(onElementClick: (element: HTMLElement, isDoubleClick: boolean) => void): void {
    if (this.active) return;
    
    this.active = true;
    this.onElementClick = onElementClick;
    
    // Change cursor
    document.body.classList.add(INTERACTIVE_CURSOR_CLASS);
    
    // Show banner
    this.showBanner();
    
    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Deactivate interactive mode
   */
  deactivate(): void {
    if (!this.active) return;
    
    this.active = false;
    
    // Restore cursor
    document.body.classList.remove(INTERACTIVE_CURSOR_CLASS);
    
    // Remove banner
    this.removeBanner();
    
    // Remove event handlers
    this.removeEventHandlers();
    
    // Remove any hover highlights
    if (this.currentHoverElement) {
      this.currentHoverElement.classList.remove(INTERACTIVE_HIGHLIGHT_CLASS);
      this.currentHoverElement = null;
    }
  }

  /**
   * Check if mode is active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Show banner indicator
   */
  private showBanner(): void {
    this.banner = document.createElement('div');
    this.banner.className = 'overflow-scout-interactive-banner';
    this.banner.innerHTML = `
      <span class="overflow-scout-interactive-banner-icon">👆</span>
      <div class="overflow-scout-interactive-banner-text">
        <div>Interactive Mode Active</div>
        <div class="overflow-scout-interactive-banner-hint">
          Click any element to test • Double-click for variations
        </div>
      </div>
      <button class="overflow-scout-interactive-banner-close">ESC</button>
    `;
    
    const closeBtn = this.banner.querySelector('.overflow-scout-interactive-banner-close');
    closeBtn?.addEventListener('click', () => this.deactivate());
    
    document.body.appendChild(this.banner);
  }

  /**
   * Remove banner
   */
  private removeBanner(): void {
    if (this.banner) {
      this.banner.remove();
      this.banner = null;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Click handler
    this.clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Ignore clicks on banner
      if (target.closest('.overflow-scout-interactive-banner')) {
        return;
      }
      
      // Ignore clicks on sidebar/panel - let them work normally!
      if (target.closest('#overflow-scout-results-panel') || 
          target.closest('#overflow-scout-auto-badge')) {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      const isDoubleClick = e.detail === 2;
      
      if (this.onElementClick) {
        this.onElementClick(target, isDoubleClick);
      }
    };

    // Hover handler for visual feedback
    this.hoverHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Ignore banner
      if (target.closest('.overflow-scout-interactive-banner')) {
        return;
      }
      
      // Ignore sidebar/panel - no highlight on sidebar!
      if (target.closest('#overflow-scout-results-panel') || 
          target.closest('#overflow-scout-auto-badge')) {
        // Remove any previous highlight when hovering over sidebar
        if (this.currentHoverElement) {
          this.currentHoverElement.classList.remove(INTERACTIVE_HIGHLIGHT_CLASS);
          this.currentHoverElement = null;
        }
        return;
      }

      // Remove previous highlight
      if (this.currentHoverElement && this.currentHoverElement !== target) {
        this.currentHoverElement.classList.remove(INTERACTIVE_HIGHLIGHT_CLASS);
      }

      // Add new highlight
      target.classList.add(INTERACTIVE_HIGHLIGHT_CLASS);
      this.currentHoverElement = target;
    };

    
    // Key handler (ESC to exit)
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.deactivate();
      }
    };
    
    // Add listeners with capture to intercept before other handlers
    document.addEventListener('click', this.clickHandler, true);
    document.addEventListener('mouseover', this.hoverHandler, true);
    document.addEventListener('keydown', this.keyHandler, true);
  }

  /**
   * Remove event handlers
   */
  private removeEventHandlers(): void {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
    
    if (this.hoverHandler) {
      document.removeEventListener('mouseover', this.hoverHandler, true);
      this.hoverHandler = null;
    }
    
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
  }
}
