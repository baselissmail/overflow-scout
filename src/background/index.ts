/**
 * Background Service Worker
 * 
 * Responsibilities:
 * - Handle cross-script messaging
 * - Maintain global extension state
 */

import { MessageType, Logger, type Message } from '@/types';

class BackgroundService {
  constructor() {
    this.init();
  }

  private init(): void {
    Logger.info('Background service worker initialized');
    
    this.setupMessageHandlers();
    this.setupInstallHandler();
  }

  /**
   * Message handler for communication with content scripts and popup
   */
  private setupMessageHandlers(): void {
    chrome.runtime.onMessage.addListener(
      (message: Message, sender, sendResponse) => {
        this.handleMessage(message, sender)
          .then(sendResponse)
          .catch((error) => {
            Logger.error('Message handling error:', error);
            sendResponse({ error: error.message });
          });
        
        return true; // Keep message channel open for async response
      }
    );
  }

  private async handleMessage(
    message: Message,
    sender: chrome.runtime.MessageSender
  ): Promise<unknown> {
    Logger.debug('Received message:', message.type, 'from', sender.tab?.id);

    switch (message.type) {
      case MessageType.PING:
        return {
          type: MessageType.PONG,
          payload: { timestamp: Date.now() },
        };

      default:
        // Check for custom message types (like screenshot capture)
        if ((message as any).type === 'CAPTURE_SCREENSHOT' && sender.tab?.id) {
          return new Promise((resolve) => {
            chrome.tabs.captureVisibleTab(
              sender.tab!.windowId,
              { format: 'png' },
              (dataUrl) => {
                if (chrome.runtime.lastError) {
                  Logger.error('Screenshot error:', chrome.runtime.lastError);
                  resolve({ error: chrome.runtime.lastError.message });
                } else {
                  resolve({ dataUrl });
                }
              }
            );
          });
        }
        
        Logger.warn('Unknown message type:', message.type);
        return { error: 'Unknown message type' };
    }
  }

  private setupInstallHandler(): void {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        Logger.info('Extension installed successfully');
        this.initializeStorage();
      } else if (details.reason === 'update') {
        Logger.info('Extension updated to version', chrome.runtime.getManifest().version);
      }
    });
  }

  private async initializeStorage(): Promise<void> {
    await chrome.storage.local.set({
      mode: 'idle',
      settings: {
        defaultTextType: 'default',
        highlightColor: '#ff6b6b',
      },
    });
    Logger.info('Storage initialized');
  }
}

// Initialize the background service
new BackgroundService();
