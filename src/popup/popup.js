/**
 * Popup Script
 *
 * Responsibilities:
 * - Display extension status and statistics
 * - Provide UI controls for testing modes
 * - Send commands to content scripts via background
 */
import { MessageType, Logger } from '@/types';
class PopupController {
    constructor() {
        this.modeStatus = null;
        this.testedCount = null;
        this.brokenCount = null;
        this.testConnectionBtn = null;
        this.init();
    }
    init() {
        Logger.info('Popup initialized');
        this.cacheElements();
        this.setupEventListeners();
        this.loadState();
    }
    cacheElements() {
        this.modeStatus = document.getElementById('mode-status');
        this.testedCount = document.getElementById('tested-count');
        this.brokenCount = document.getElementById('broken-count');
        this.testConnectionBtn = document.getElementById('test-connection');
    }
    setupEventListeners() {
        if (this.testConnectionBtn) {
            this.testConnectionBtn.addEventListener('click', () => this.testConnection());
        }
    }
    /**
     * Load current state from storage
     */
    async loadState() {
        try {
            const result = await chrome.storage.local.get(['mode', 'testedElements', 'brokenElements']);
            if (this.modeStatus) {
                this.modeStatus.textContent = result.mode || 'Idle';
            }
            if (this.testedCount) {
                this.testedCount.textContent = String(result.testedElements || 0);
            }
            if (this.brokenCount) {
                this.brokenCount.textContent = String(result.brokenElements || 0);
            }
            // Enable test button once state is loaded
            if (this.testConnectionBtn) {
                this.testConnectionBtn.disabled = false;
            }
            Logger.debug('State loaded:', result);
        }
        catch (error) {
            Logger.error('Failed to load state:', error);
        }
    }
    /**
     * Test connection to background and content scripts
     */
    async testConnection() {
        if (!this.testConnectionBtn)
            return;
        this.testConnectionBtn.disabled = true;
        this.testConnectionBtn.textContent = 'Testing...';
        try {
            // Test background connection
            const response = await chrome.runtime.sendMessage({
                type: MessageType.PING,
            });
            Logger.info('Background response:', response);
            // Test content script connection
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab.id) {
                const contentResponse = await chrome.tabs.sendMessage(tab.id, {
                    type: MessageType.PING,
                });
                Logger.info('Content script response:', contentResponse);
            }
            this.showSuccess('✓ Connection test passed!');
        }
        catch (error) {
            Logger.error('Connection test failed:', error);
            this.showError('✗ Connection test failed');
        }
        finally {
            setTimeout(() => {
                if (this.testConnectionBtn) {
                    this.testConnectionBtn.disabled = false;
                    this.testConnectionBtn.textContent = 'Test Connection';
                }
            }, 2000);
        }
    }
    showSuccess(message) {
        if (this.testConnectionBtn) {
            this.testConnectionBtn.textContent = message;
            this.testConnectionBtn.style.background = 'var(--success)';
        }
    }
    showError(message) {
        if (this.testConnectionBtn) {
            this.testConnectionBtn.textContent = message;
            this.testConnectionBtn.style.background = 'var(--error)';
        }
    }
}
// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PopupController());
}
else {
    new PopupController();
}
