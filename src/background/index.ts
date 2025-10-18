/**
 * Background Service Worker
 * 
 * Responsibilities:
 * - Manage context menus
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
    
    this.setupContextMenus();
    this.setupMessageHandlers();
    this.setupInstallHandler();
  }

  /**
   * Phase 1: Context menu setup
   */
  private setupContextMenus(): void {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create({
        id: 'overflow-scout-main',
        title: 'Overflow Scout',
        contexts: ['all'],
      });

      chrome.contextMenus.create({
        id: 'test-long-text',
        parentId: 'overflow-scout-main',
        title: 'Test with long text',
        contexts: ['all'],
        enabled: true,
      });

      chrome.contextMenus.create({
        id: 'revert-text',
        parentId: 'overflow-scout-main',
        title: 'Revert to original',
        contexts: ['all'],
        enabled: true,
      });

      Logger.info('Context menus created');
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  }

  private handleContextMenuClick(
    info: chrome.contextMenus.OnClickData,
    tab?: chrome.tabs.Tab
  ): void {
    Logger.debug('Context menu clicked:', info.menuItemId);

    if (!tab?.id) {
      Logger.warn('No active tab found');
      return;
    }

    switch (info.menuItemId) {
      case 'test-long-text':
        this.sendMessageToTab(tab.id, {
          type: MessageType.INJECT_TEXT,
          payload: {},
        });
        break;

      case 'revert-text':
        this.sendMessageToTab(tab.id, {
          type: MessageType.REVERT_TEXT,
          payload: {},
        });
        break;

      default:
        Logger.debug('Unknown menu item:', info.menuItemId);
    }
  }

  private async sendMessageToTab(
    tabId: number,
    message: Message
  ): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, message);
      Logger.debug('Message sent to tab:', tabId, message.type);
    } catch (error) {
      // Content script not ready or not on compatible page
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Receiving end does not exist')) {
        Logger.warn('Content script not loaded on this page. Try refreshing the page.');
      } else {
        Logger.error('Failed to send message to tab:', error);
      }
    }
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
