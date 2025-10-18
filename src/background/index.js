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
     * Currently creates a placeholder menu structure
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
                title: 'Test with long text (Phase 1)',
                contexts: ['all'],
                enabled: false, // Will be enabled in Phase 1
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
        // Phase 1 will implement actual handlers
        switch (info.menuItemId) {
            case 'test-long-text':
                Logger.info('Test long text requested (not yet implemented)');
                break;
            default:
                Logger.debug('Unknown menu item:', info.menuItemId);
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
