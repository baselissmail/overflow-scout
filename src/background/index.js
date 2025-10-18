/**
 * Background Service Worker
 *
 * Responsibilities:
 * - Manage context menus
 * - Handle cross-script messaging
 * - Maintain global extension state
 */
import { MessageType, Logger } from '@/types';
class BackgroundService {
    constructor() {
        this.init();
    }
    init() {
        Logger.info('Background service worker initialized');
        this.setupContextMenus();
        this.setupMessageHandlers();
        this.setupInstallHandler();
    }
    /**
     * Phase 1: Context menu setup
     */
    setupContextMenus() {
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
    handleContextMenuClick(info, tab) {
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
    async sendMessageToTab(tabId, message) {
        try {
            await chrome.tabs.sendMessage(tabId, message);
            Logger.debug('Message sent to tab:', tabId, message.type);
        }
        catch (error) {
            Logger.error('Failed to send message to tab:', error);
        }
    }
    /**
     * Message handler for communication with content scripts and popup
     */
    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender)
                .then(sendResponse)
                .catch((error) => {
                Logger.error('Message handling error:', error);
                sendResponse({ error: error.message });
            });
            return true; // Keep message channel open for async response
        });
    }
    async handleMessage(message, sender) {
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
    setupInstallHandler() {
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                Logger.info('Extension installed successfully');
                this.initializeStorage();
            }
            else if (details.reason === 'update') {
                Logger.info('Extension updated to version', chrome.runtime.getManifest().version);
            }
        });
    }
    async initializeStorage() {
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
