/**
 * Content Script
 * 
 * Responsibilities:
 * - Detect and manipulate DOM elements
 * - Inject and revert text
 * - Detect overflow issues
 * - Apply visual highlights
 * 
 * This script runs in the context of web pages
 */

import { MessageType, Logger, type Message } from '@/types';

class OverflowScoutContent {
  private initialized = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (this.initialized) return;

    Logger.info('Content script initialized on', window.location.href);
    
    this.setupMessageHandlers();
    this.setupDOMObserver();
    this.notifyBackgroundReady();
    
    this.initialized = true;
  }

  /**
   * Set up message listener for commands from background/popup
   */
  private setupMessageHandlers(): void {
    chrome.runtime.onMessage.addListener(
      (message: Message, _sender, sendResponse) => {
        this.handleMessage(message)
          .then(sendResponse)
          .catch((error) => {
            Logger.error('Content script message error:', error);
            sendResponse({ error: error.message });
          });
        
        return true; // Keep channel open for async
      }
    );
  }

  private async handleMessage(message: Message): Promise<unknown> {
    Logger.debug('Content received message:', message.type);

    switch (message.type) {
      case MessageType.PING:
        return {
          type: MessageType.PONG,
          payload: { timestamp: Date.now(), url: window.location.href },
        };

      // Phase 1+ handlers will be added here
      case MessageType.INJECT_TEXT:
        Logger.info('Inject text requested (Phase 1 - not yet implemented)');
        return { success: false, message: 'Not implemented yet' };

      default:
        Logger.warn('Unknown message type in content:', message.type);
        return { error: 'Unknown message type' };
    }
  }

  /**
   * Phase 6: Set up MutationObserver for SPA re-render handling
   * Currently a placeholder
   */
  private setupDOMObserver(): void {
    // Will be implemented in Phase 6
    Logger.debug('DOM observer ready (passive mode)');
  }

  /**
   * Notify background script that content script is ready
   */
  private notifyBackgroundReady(): void {
    chrome.runtime.sendMessage({
      type: MessageType.PONG,
      payload: { ready: true, url: window.location.href },
    }).catch(() => {
      // Background might not be ready yet, that's ok
      Logger.debug('Background not ready yet');
    });
  }

  // Future phase methods will be added here:
  // Phase 1: findTextHost() - locate text-bearing element
  // Phase 2: detectElementType() - determine appropriate text generation
  // Phase 3: detectOverflow() - identify clipping/ellipsis issues
  // Phase 4: batchTestSimilar() - group and test similar elements
  // Phase 5: revertAll() - restore all original text
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new OverflowScoutContent());
} else {
  new OverflowScoutContent();
}
