/**
 * Popup Script
 * 
 * Responsibilities:
 * - Display extension status and statistics
 * - Provide UI controls for testing modes
 * - Send commands to content scripts via background
 */

import { MessageType, Logger, TestMode } from '@/types';

class PopupController {
  private testedCount: HTMLElement | null = null;
  private brokenCount: HTMLElement | null = null;
  private modeSelector: HTMLSelectElement | null = null;
  private testAllButtonsBtn: HTMLButtonElement | null = null;
  private testAllHeadingsBtn: HTMLButtonElement | null = null;
  private testAllInputsBtn: HTMLButtonElement | null = null;
  private testAllLinksBtn: HTMLButtonElement | null = null;
  private revertAllBtn: HTMLButtonElement | null = null;
  private updateInterval: number | null = null;
  
  // Phase 9: New controls
  private optionsToggle: HTMLButtonElement | null = null;
  private optionsContent: HTMLElement | null = null;
  private lengthMultiplier: HTMLInputElement | null = null;
  private lengthValue: HTMLElement | null = null;
  private viewportOnly: HTMLInputElement | null = null;
  private showBrokenOnly: HTMLInputElement | null = null;
  private presetButtons: NodeListOf<HTMLButtonElement> | null = null;
  
  // Phase 9: Interactive mode
  private interactiveModeBtn: HTMLButtonElement | null = null;
  private isInteractiveModeActive = false;
  
  // Phase 10: Auto-scan
  private autoScanBtn: HTMLButtonElement | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    Logger.info('Popup initialized');
    
    this.cacheElements();
    this.setupEventListeners();
    this.loadSettings();
    this.updateStats();
    this.startStatsPolling();
    
    // Cleanup on unload
    window.addEventListener('unload', () => this.stopStatsPolling());
  }

  private cacheElements(): void {
    this.testedCount = document.getElementById('tested-count');
    this.brokenCount = document.getElementById('broken-count');
    this.modeSelector = document.getElementById('mode-selector') as HTMLSelectElement;
    this.testAllButtonsBtn = document.getElementById('test-all-buttons') as HTMLButtonElement;
    this.testAllHeadingsBtn = document.getElementById('test-all-headings') as HTMLButtonElement;
    this.testAllInputsBtn = document.getElementById('test-all-inputs') as HTMLButtonElement;
    this.testAllLinksBtn = document.getElementById('test-all-links') as HTMLButtonElement;
    this.revertAllBtn = document.getElementById('revert-all') as HTMLButtonElement;
    
    // Phase 9: New UI controls
    this.optionsToggle = document.getElementById('options-toggle') as HTMLButtonElement;
    this.optionsContent = document.getElementById('options-content');
    this.lengthMultiplier = document.getElementById('length-multiplier') as HTMLInputElement;
    this.lengthValue = document.getElementById('length-value');
    this.viewportOnly = document.getElementById('viewport-only') as HTMLInputElement;
    this.showBrokenOnly = document.getElementById('show-broken-only') as HTMLInputElement;
    this.presetButtons = document.querySelectorAll('.preset-btn');
    
    // Phase 9: Interactive mode
    this.interactiveModeBtn = document.getElementById('interactive-mode') as HTMLButtonElement;
    
    // Phase 10: Auto-scan
    this.autoScanBtn = document.getElementById('auto-scan') as HTMLButtonElement;
  }

  private setupEventListeners(): void {
    // Mode selector
    this.modeSelector?.addEventListener('change', () => this.saveMode());

    // Batch test buttons
    this.testAllButtonsBtn?.addEventListener('click', () => this.sendMessage(MessageType.TEST_ALL_BUTTONS));
    this.testAllHeadingsBtn?.addEventListener('click', () => this.sendMessage(MessageType.TEST_ALL_HEADINGS));
    this.testAllInputsBtn?.addEventListener('click', () => this.sendMessage(MessageType.TEST_ALL_INPUTS));
    this.testAllLinksBtn?.addEventListener('click', () => this.sendMessage(MessageType.TEST_ALL_LINKS));
    
    // Revert all
    this.revertAllBtn?.addEventListener('click', () => this.sendMessage(MessageType.REVERT_ALL));
    
    // Phase 9: New UI controls
    this.optionsToggle?.addEventListener('click', () => this.toggleOptions());
    this.lengthMultiplier?.addEventListener('input', () => this.updateLengthValue());
    
    // Preset buttons
    this.presetButtons?.forEach(btn => {
      btn.addEventListener('click', () => this.selectPreset(btn.dataset.preset || 'scan'));
    });
    
    // Phase 9: Interactive mode button
    this.interactiveModeBtn?.addEventListener('click', () => this.toggleInteractiveMode());
    
    // Phase 10: Auto-scan button
    this.autoScanBtn?.addEventListener('click', () => this.runAutoScan());
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['mode']);
      const mode = result.mode || TestMode.DEFAULT; // Phase 7: Default to English
      
      if (this.modeSelector) {
        this.modeSelector.value = mode;
      }

      Logger.debug('Settings loaded:', result);
    } catch (error) {
      Logger.error('Failed to load settings:', error);
    }
  }

  /**
   * Save mode to storage
   */
  private async saveMode(): Promise<void> {
    if (!this.modeSelector) return;

    const mode = this.modeSelector.value as TestMode;
    
    try {
      await chrome.storage.local.set({ mode });
      Logger.info('Mode saved:', mode);
      
      // Notify content script of mode change
      this.sendMessage(MessageType.SET_MODE, { mode });
    } catch (error) {
      Logger.error('Failed to save mode:', error);
    }
  }

  /**
   * Update stats from active tab
   */
  private async updateStats(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) return;

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: MessageType.GET_STATE,
      });

      if (response) {
        if (this.testedCount) {
          this.testedCount.textContent = String(response.elementCount || 0);
        }
        
        if (this.brokenCount) {
          this.brokenCount.textContent = String(response.brokenCount || 0);
        }
        
        // Phase 9: Check if interactive mode is still active in content script
        if (response.interactiveModeActive !== undefined) {
          const wasActive = this.isInteractiveModeActive;
          this.isInteractiveModeActive = response.interactiveModeActive;
          
          // Update button if state changed
          if (wasActive !== this.isInteractiveModeActive) {
            this.updateInteractiveModeButton();
          }
        }
      }
    } catch (error) {
      // Content script may not be ready yet
      Logger.debug('Stats update failed:', error);
    }
  }

  /**
   * Send message to active tab
   */
  private async sendMessage(type: MessageType, payload: unknown = {}): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        Logger.warn('No active tab found');
        return;
      }

      await chrome.tabs.sendMessage(tab.id, { type, payload });
      Logger.info('Message sent:', type);
      
      // Update stats after action
      setTimeout(() => this.updateStats(), 500);
    } catch (error) {
      Logger.error('Failed to send message:', error);
    }
  }

  /**
   * Poll stats every second
   */
  private startStatsPolling(): void {
    this.updateInterval = window.setInterval(() => {
      this.updateStats();
    }, 1000);
  }

  /**
   * Stop polling when popup closes
   */
  private stopStatsPolling(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  /**
   * Phase 9: Toggle options panel
   */
  private toggleOptions(): void {
    if (!this.optionsContent || !this.optionsToggle) return;
    
    const isVisible = this.optionsContent.style.display !== 'none';
    this.optionsContent.style.display = isVisible ? 'none' : 'block';
    this.optionsToggle.classList.toggle('active');
  }
  
  /**
   * Phase 9: Update length value display
   */
  private updateLengthValue(): void {
    if (!this.lengthMultiplier || !this.lengthValue) return;
    this.lengthValue.textContent = `${this.lengthMultiplier.value}x`;
  }
  
  /**
   * Phase 9: Select preset mode
   */
  private selectPreset(preset: string): void {
    // Update active state
    this.presetButtons?.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === preset);
    });
    
    // Apply preset settings
    if (preset === 'scan') {
      // Fast & clean mode
      if (this.viewportOnly) this.viewportOnly.checked = true;
      if (this.showBrokenOnly) this.showBrokenOnly.checked = true;
      if (this.lengthMultiplier) this.lengthMultiplier.value = '2.5';
      this.updateLengthValue();
    } else if (preset === 'deep') {
      // Full test mode
      if (this.viewportOnly) this.viewportOnly.checked = false;
      if (this.showBrokenOnly) this.showBrokenOnly.checked = false;
      if (this.lengthMultiplier) this.lengthMultiplier.value = '3';
      this.updateLengthValue();
    }
    
    Logger.info('Preset selected:', preset);
  }
  
  /**
   * Phase 9: Toggle interactive mode
   */
  private async toggleInteractiveMode(): Promise<void> {
    this.isInteractiveModeActive = !this.isInteractiveModeActive;
    
    try {
      await this.sendMessage(MessageType.TOGGLE_INTERACTIVE_MODE, {
        active: this.isInteractiveModeActive,
      });
      
      this.updateInteractiveModeButton();
      Logger.info('Interactive mode toggled:', this.isInteractiveModeActive);
      
      // Close popup when activating (not deactivating)
      // Add longer delay to prevent clicking element behind popup
      if (this.isInteractiveModeActive) {
        setTimeout(() => {
          window.close();
        }, 300);
      }
    } catch (error) {
      Logger.error('Failed to toggle interactive mode:', error);
      this.isInteractiveModeActive = !this.isInteractiveModeActive; // Revert on error
    }
  }
  
  /**
   * Phase 9: Update interactive mode button UI
   */
  private updateInteractiveModeButton(): void {
    if (!this.interactiveModeBtn) return;
    
    if (this.isInteractiveModeActive) {
      this.interactiveModeBtn.classList.add('active');
      this.interactiveModeBtn.innerHTML = `
        <span class="btn-icon">✋</span>
        Exit Interactive Mode
        <small>Press ESC or click here</small>
      `;
    } else {
      this.interactiveModeBtn.classList.remove('active');
      this.interactiveModeBtn.innerHTML = `
        <span class="btn-icon">👆</span>
        Point & Click Mode
        <small>Click elements to test</small>
      `;
    }
  }
  
  /**
   * Phase 10: Run auto-scan
   */
  private async runAutoScan(): Promise<void> {
    if (!this.autoScanBtn) return;
    
    // Show loading state
    this.autoScanBtn.disabled = true;
    this.autoScanBtn.innerHTML = `
      <span class="btn-icon">⏳</span>
      Scanning...
      <small>Please wait</small>
    `;
    
    try {
      await this.sendMessage(MessageType.AUTO_SCAN);
      
      Logger.info('Auto-scan triggered successfully');
      
      // Close popup after a short delay to ensure message is sent
      setTimeout(() => {
        window.close();
      }, 100);
    } catch (error) {
      Logger.error('Failed to trigger auto-scan:', error);
      
      // Reset button on error
      if (this.autoScanBtn) {
        this.autoScanBtn.disabled = false;
        this.autoScanBtn.innerHTML = `
          <span class="btn-icon">🤖</span>
          Auto-Scan Page
          <small>Find all overflow issues instantly</small>
        `;
      }
    }
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupController());
} else {
  new PopupController();
}
