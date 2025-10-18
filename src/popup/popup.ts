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
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['mode']);
      const mode = result.mode || TestMode.MIXED;
      
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
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupController());
} else {
  new PopupController();
}
