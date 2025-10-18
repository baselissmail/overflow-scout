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
import { MessageType, Logger, ElementType } from '@/types';
class OverflowScoutContent {
    constructor() {
        this.initialized = false;
        this.lastClickedElement = null;
        this.elementCache = new Map();
        this.elementIdCounter = 0;
        this.init();
    }
    /**
     * Cache for storing original element states
     */
    getElementId(element) {
        let id = element.getAttribute('data-overflow-scout-id');
        if (!id) {
            id = `os-${this.elementIdCounter++}`;
            element.setAttribute('data-overflow-scout-id', id);
        }
        return id;
    }
    init() {
        if (this.initialized)
            return;
        Logger.info('Content script initialized on', window.location.href);
        this.setupMessageHandlers();
        this.setupClickTracking();
        this.setupDOMObserver();
        this.notifyBackgroundReady();
        this.initialized = true;
    }
    /**
     * Track right-clicked elements for context menu actions
     */
    setupClickTracking() {
        document.addEventListener('contextmenu', (e) => {
            this.lastClickedElement = e.target;
            Logger.debug('Element right-clicked:', this.lastClickedElement.tagName);
        });
    }
    /**
     * Set up message listener for commands from background/popup
     */
    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            this.handleMessage(message)
                .then(sendResponse)
                .catch((error) => {
                Logger.error('Content script message error:', error);
                sendResponse({ error: error.message });
            });
            return true; // Keep channel open for async
        });
    }
    async handleMessage(message) {
        Logger.debug('Content received message:', message.type);
        switch (message.type) {
            case MessageType.PING:
                return {
                    type: MessageType.PONG,
                    payload: { timestamp: Date.now(), url: window.location.href },
                };
            case MessageType.INJECT_TEXT:
                return this.injectText();
            case MessageType.REVERT_TEXT:
                return this.revertText();
            default:
                Logger.warn('Unknown message type in content:', message.type);
                return { error: 'Unknown message type' };
        }
    }
    /**
     * Phase 6: Set up MutationObserver for SPA re-render handling
     * Currently a placeholder
     */
    setupDOMObserver() {
        // Will be implemented in Phase 6
        Logger.debug('DOM observer ready (passive mode)');
    }
    /**
     * Notify background script that content script is ready
     */
    notifyBackgroundReady() {
        chrome.runtime.sendMessage({
            type: MessageType.PONG,
            payload: { ready: true, url: window.location.href },
        }).catch(() => {
            // Background might not be ready yet, that's ok
            Logger.debug('Background not ready yet');
        });
    }
    /**
     * Phase 1: Inject test text into the last clicked element
     */
    injectText() {
        if (!this.lastClickedElement) {
            Logger.warn('No element to inject text into');
            return { success: false, message: 'No element selected' };
        }
        const textHost = this.findTextHost(this.lastClickedElement);
        if (!textHost) {
            Logger.warn('Could not find text host element');
            return { success: false, message: 'Element cannot contain text' };
        }
        const elementId = this.getElementId(textHost);
        const elementType = this.detectElementType(textHost);
        const testString = this.generateTestString(elementType);
        // Cache original value before injection
        const original = this.cacheOriginalValue(textHost, elementType);
        // Inject the test string
        this.setElementText(textHost, elementType, testString);
        Logger.info('Injected text:', {
            elementId,
            type: elementType,
            original: original.substring(0, 50),
            injected: testString.substring(0, 50),
        });
        return {
            success: true,
            message: `Injected ${testString.length} characters`,
        };
    }
    /**
     * Phase 1: Revert the last clicked element to original text
     */
    revertText() {
        if (!this.lastClickedElement) {
            return { success: false, message: 'No element selected' };
        }
        const elementId = this.lastClickedElement.getAttribute('data-overflow-scout-id');
        if (!elementId || !this.elementCache.has(elementId)) {
            return { success: false, message: 'Element not modified' };
        }
        const cache = this.elementCache.get(elementId);
        this.setElementText(this.lastClickedElement, cache.elementType, cache.originalValue);
        this.elementCache.delete(elementId);
        this.lastClickedElement.removeAttribute('data-overflow-scout-id');
        Logger.info('Reverted element:', elementId);
        return { success: true, message: 'Reverted to original' };
    }
    /**
     * Find the actual text-bearing element (not wrapper divs)
     */
    findTextHost(element) {
        // Handle form inputs
        if (element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement) {
            return element;
        }
        // Handle contenteditable
        if (element.isContentEditable) {
            return element;
        }
        // Handle elements with text content
        if (element.textContent && element.textContent.trim()) {
            return element;
        }
        // Handle elements with aria-label or placeholder
        if (element.getAttribute('aria-label') || element.getAttribute('placeholder')) {
            return element;
        }
        return null;
    }
    /**
     * Detect the type of element for appropriate text handling
     */
    detectElementType(element) {
        if (element instanceof HTMLInputElement) {
            return element.placeholder ? ElementType.PLACEHOLDER : ElementType.INPUT;
        }
        if (element instanceof HTMLTextAreaElement) {
            return ElementType.TEXTAREA;
        }
        if (element.isContentEditable) {
            return ElementType.CONTENTEDITABLE;
        }
        if (element.getAttribute('aria-label')) {
            return ElementType.ARIA_LABEL;
        }
        if (/^H[1-6]$/.test(element.tagName)) {
            return ElementType.HEADING;
        }
        if (element.tagName === 'BUTTON') {
            return ElementType.BUTTON;
        }
        return ElementType.TEXT;
    }
    /**
     * Cache the original value before modification
     */
    cacheOriginalValue(element, type) {
        const elementId = this.getElementId(element);
        let originalValue = '';
        if (type === ElementType.INPUT || type === ElementType.TEXTAREA) {
            originalValue = element.value;
        }
        else if (type === ElementType.PLACEHOLDER) {
            originalValue = element.placeholder;
        }
        else if (type === ElementType.ARIA_LABEL) {
            originalValue = element.getAttribute('aria-label') || '';
        }
        else {
            originalValue = element.textContent || '';
        }
        this.elementCache.set(elementId, {
            element,
            originalValue,
            elementType: type,
        });
        return originalValue;
    }
    /**
     * Set text on an element based on its type
     */
    setElementText(element, type, text) {
        if (type === ElementType.INPUT || type === ElementType.TEXTAREA) {
            element.value = text;
        }
        else if (type === ElementType.PLACEHOLDER) {
            element.placeholder = text;
        }
        else if (type === ElementType.ARIA_LABEL) {
            element.setAttribute('aria-label', text);
        }
        else {
            element.textContent = text;
        }
    }
    /**
     * Generate a long test string based on element type
     * Phase 2 will make this more sophisticated
     */
    generateTestString(type) {
        const baseStrings = {
            [ElementType.BUTTON]: 'Internationalization and Localization',
            [ElementType.HEADING]: 'Übersetzung und Internationalisierung von Benutzeroberflächen',
            [ElementType.INPUT]: 'This is a very long input value that will test overflow behavior in input fields',
            [ElementType.TEXTAREA]: 'This is an extremely long textarea content that spans multiple lines and tests how the interface handles overflow in multiline text areas with very long content that might cause layout issues',
            [ElementType.PLACEHOLDER]: 'Enter your extremely long international address here',
            [ElementType.TEXT]: 'This is a substantially long text string designed to test overflow, text wrapping, ellipsis, and clipping behavior in user interface elements',
            [ElementType.ARIA_LABEL]: 'Very long accessibility label for screen readers',
            [ElementType.CONTENTEDITABLE]: 'Editable content with an unreasonably long string',
        };
        return baseStrings[type] || baseStrings[ElementType.TEXT];
    }
}
// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new OverflowScoutContent());
}
else {
    new OverflowScoutContent();
}
