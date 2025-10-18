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

import { MessageType, Logger, ElementType, type Message, type OverflowDetection } from '@/types';
import {
  TEXT_PATTERNS,
  COMPONENT_PATTERNS,
  TextPatternType,
  getRandomPattern,
  getTextByLength,
} from '@/lib/textPatterns';
import { detectOverflow, getOverflowSeverity } from '@/lib/overflowDetector';
import { createHighlight, removeHighlight } from '@/lib/highlighter';

/**
 * Cache structure for storing original element state
 */
interface ElementCache {
  element: HTMLElement;
  originalValue: string;
  elementType: ElementType;
  overflowDetection?: OverflowDetection;
}

class OverflowScoutContent {
  private initialized = false;
  private lastClickedElement: HTMLElement | null = null;
  private elementCache = new Map<string, ElementCache>();
  private elementIdCounter = 0;

  constructor() {
    this.init();
  }

  /**
   * Cache for storing original element states
   */
  private getElementId(element: HTMLElement): string {
    let id = element.getAttribute('data-overflow-scout-id');
    if (!id) {
      id = `os-${this.elementIdCounter++}`;
      element.setAttribute('data-overflow-scout-id', id);
    }
    return id;
  }

  private init(): void {
    if (this.initialized) return;

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
  private setupClickTracking(): void {
    document.addEventListener('contextmenu', (e) => {
      this.lastClickedElement = e.target as HTMLElement;
      Logger.debug('Element right-clicked:', this.lastClickedElement.tagName);
    });
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

  /**
   * Phase 1-3: Inject test text and detect overflow
   */
  private injectText(): { success: boolean; message?: string } {
    if (!this.lastClickedElement) {
      Logger.warn('No element to inject text into');
      return { success: false, message: 'No element selected' };
    }

    const textHost = this.findTextHost(this.lastClickedElement);
    if (!textHost) {
      Logger.warn('Could not find text host element');
      return { success: false, message: 'Element cannot contain text' };
    }

    const elementType = this.detectElementType(textHost);
    
    // Cache BEFORE getting test string (preserves true original on re-inject)
    const original = this.cacheOriginalValue(textHost, elementType);
    
    // Generate test string based on element type AND original length
    const testString = this.generateTestString(elementType, original);
    
    // Inject the test string
    this.setElementText(textHost, elementType, testString);

    // Phase 3: Detect overflow after injection
    // Wait for layout to settle
    requestAnimationFrame(() => {
      const detection = detectOverflow(textHost);
      const elementId = this.getElementId(textHost);
      
      // Store detection results in cache
      const cache = this.elementCache.get(elementId);
      if (cache) {
        cache.overflowDetection = detection;
      }

      // Auto-highlight if overflow detected
      if (detection.hasOverflow) {
        createHighlight(textHost, detection, original, testString);
        const severity = getOverflowSeverity(detection);
        Logger.info('Overflow detected:', {
          elementId,
          severity,
          types: detection.types,
          details: detection.details,
        });
      } else {
        Logger.debug('No overflow detected for', elementId);
      }
    });

    const elementId = this.getElementId(textHost);
    Logger.info('Injected text:', {
      elementId,
      type: elementType,
      originalLength: original.length,
      injectedLength: testString.length,
      original: original.substring(0, 50),
      injected: testString.substring(0, 50),
    });

    return {
      success: true,
      message: `Injected ${testString.length} chars (was ${original.length})`,
    };
  }

  /**
   * Phase 1-3: Revert element and remove highlight
   */
  private revertText(): { success: boolean; message?: string } {
    if (!this.lastClickedElement) {
      return { success: false, message: 'No element selected' };
    }

    const elementId = this.lastClickedElement.getAttribute('data-overflow-scout-id');
    if (!elementId || !this.elementCache.has(elementId)) {
      return { success: false, message: 'Element not modified' };
    }

    const cache = this.elementCache.get(elementId)!;
    
    // Revert text
    this.setElementText(this.lastClickedElement, cache.elementType, cache.originalValue);
    
    // Phase 3: Remove highlight
    removeHighlight(this.lastClickedElement);
    
    // Clean up
    this.elementCache.delete(elementId);
    this.lastClickedElement.removeAttribute('data-overflow-scout-id');

    Logger.info('Reverted element:', elementId);

    return { success: true, message: 'Reverted to original' };
  }

  /**
   * Find the actual text-bearing element (not wrapper divs)
   */
  private findTextHost(element: HTMLElement): HTMLElement | null {
    // Handle form inputs
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
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
   * Phase 2: Enhanced element type detection with context
   */
  private detectElementType(element: HTMLElement): ElementType {
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const className = element.className;

    // Input field type detection
    if (element instanceof HTMLInputElement) {
      const inputType = element.type.toLowerCase();
      
      if (element.placeholder) return ElementType.PLACEHOLDER;
      
      switch (inputType) {
        case 'email': return ElementType.INPUT_EMAIL;
        case 'search': return ElementType.INPUT_SEARCH;
        case 'tel': return ElementType.INPUT_TEL;
        case 'url': return ElementType.INPUT_URL;
        default: return ElementType.INPUT;
      }
    }

    if (element instanceof HTMLTextAreaElement) {
      return ElementType.TEXTAREA;
    }

    if (element.isContentEditable) {
      return ElementType.CONTENTEDITABLE;
    }

    // Link detection
    if (element.tagName === 'A') {
      return ElementType.LINK;
    }

    // Button detection with submit variant
    if (element.tagName === 'BUTTON' || role === 'button') {
      const type = (element as HTMLButtonElement).type;
      return type === 'submit' ? ElementType.BUTTON_SUBMIT : ElementType.BUTTON;
    }

    // Label detection
    if (element.tagName === 'LABEL') {
      return ElementType.LABEL;
    }

    // Heading detection
    if (/^H[1-6]$/.test(element.tagName)) {
      return ElementType.HEADING;
    }

    // Notification/alert detection
    if (
      role === 'alert' ||
      role === 'status' ||
      /\b(alert|notification|toast|snackbar)\b/i.test(className)
    ) {
      return ElementType.NOTIFICATION;
    }

    // Breadcrumb detection
    if (
      role === 'navigation' &&
      /\b(breadcrumb|breadcrumbs)\b/i.test(className || ariaLabel || '')
    ) {
      return ElementType.BREADCRUMB;
    }

    // ARIA label as fallback
    if (ariaLabel) {
      return ElementType.ARIA_LABEL;
    }

    return ElementType.TEXT;
  }

  /**
   * Cache the original value before modification
   * IMPORTANT: Only cache if not already cached (preserve true original)
   */
  private cacheOriginalValue(element: HTMLElement, type: ElementType): string {
    const elementId = this.getElementId(element);
    
    // Check if already cached - if so, return existing original
    const existingCache = this.elementCache.get(elementId);
    if (existingCache) {
      Logger.debug('Element already cached, preserving original:', elementId);
      return existingCache.originalValue;
    }

    // First time caching - get the current value as original
    let originalValue = '';

    if (type === ElementType.INPUT || type === ElementType.TEXTAREA) {
      originalValue = (element as HTMLInputElement | HTMLTextAreaElement).value;
    } else if (type === ElementType.PLACEHOLDER) {
      originalValue = (element as HTMLInputElement).placeholder;
    } else if (type === ElementType.ARIA_LABEL) {
      originalValue = element.getAttribute('aria-label') || '';
    } else {
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
  private setElementText(element: HTMLElement, type: ElementType, text: string): void {
    if (type === ElementType.INPUT || type === ElementType.TEXTAREA) {
      (element as HTMLInputElement | HTMLTextAreaElement).value = text;
    } else if (type === ElementType.PLACEHOLDER) {
      (element as HTMLInputElement).placeholder = text;
    } else if (type === ElementType.ARIA_LABEL) {
      element.setAttribute('aria-label', text);
    } else {
      element.textContent = text;
    }
  }

  /**
   * Phase 2: Smart text generation with pattern library
   * Returns varied, realistic, context-appropriate test strings
   * Now considers original text length to ensure test is LONGER
   */
  private generateTestString(type: ElementType, originalText: string = ''): string {
    // Component-specific patterns
    switch (type) {
      case ElementType.BUTTON:
      case ElementType.BUTTON_SUBMIT:
        return getRandomPattern(COMPONENT_PATTERNS.button);

      case ElementType.LINK:
        return getRandomPattern(COMPONENT_PATTERNS.link);

      case ElementType.LABEL:
        return getRandomPattern(COMPONENT_PATTERNS.label);

      case ElementType.PLACEHOLDER:
        return getRandomPattern(COMPONENT_PATTERNS.placeholder);

      case ElementType.HEADING:
        // For headings, use i18n patterns (good for testing)
        return getRandomPattern(COMPONENT_PATTERNS.heading);

      case ElementType.NOTIFICATION:
        return getRandomPattern(COMPONENT_PATTERNS.notification);

      case ElementType.BREADCRUMB:
        return getRandomPattern(COMPONENT_PATTERNS.breadcrumb);

      // Input type-specific patterns
      case ElementType.INPUT_EMAIL:
        return 'extremely.long.email.address.for.testing@international-company-domain-name.com';

      case ElementType.INPUT_URL:
        return 'https://www.extremely-long-international-domain-name-for-overflow-testing.com/path/to/resource';

      case ElementType.INPUT_SEARCH:
        return 'searching for extremely specific international product with very long descriptive name';

      case ElementType.INPUT_TEL:
        return '+1 (555) 123-4567 ext. 89012';

      case ElementType.INPUT:
        return getTextByLength(TEXT_PATTERNS[TextPatternType.DEFAULT], 'long');

      case ElementType.TEXTAREA:
        return this.getMultiPatternText();

      case ElementType.CONTENTEDITABLE:
        return getTextByLength(TEXT_PATTERNS[TextPatternType.UGC_COMMENT], 'long');

      case ElementType.ARIA_LABEL:
        return getTextByLength(TEXT_PATTERNS[TextPatternType.FORMAL], 'long');

      // Default text patterns - smart selection based on original length
      case ElementType.TEXT:
      default:
        return this.selectTextPattern(originalText);
    }
  }

  /**
   * Select pattern type based on original length
   * Use i18n for short original text, English for already-long text
   */
  private selectTextPattern(originalText: string): string {
    const originalLength = originalText.trim().length;

    // If original is already long (>50 chars), test with even longer English
    if (originalLength > 50) {
      return getTextByLength(TEXT_PATTERNS[TextPatternType.UGC_COMMENT], 'long');
    }

    // For short original text, rotate through i18n patterns
    const patterns = [
      TEXT_PATTERNS[TextPatternType.DEFAULT],
      TEXT_PATTERNS[TextPatternType.I18N_GERMAN],
      TEXT_PATTERNS[TextPatternType.I18N_ARABIC],
      TEXT_PATTERNS[TextPatternType.I18N_CJK],
    ];

    const randomIndex = Math.floor(Math.random() * patterns.length);
    return getTextByLength(patterns[randomIndex], 'long');
  }

  /**
   * Generate multi-language text for textareas
   */
  private getMultiPatternText(): string {
    return [
      getTextByLength(TEXT_PATTERNS[TextPatternType.DEFAULT], 'medium'),
      getTextByLength(TEXT_PATTERNS[TextPatternType.I18N_GERMAN], 'medium'),
      getTextByLength(TEXT_PATTERNS[TextPatternType.I18N_ARABIC], 'medium'),
      getTextByLength(TEXT_PATTERNS[TextPatternType.I18N_CJK], 'medium'),
    ].join('\n\n');
  }

  // Future phase methods:
  // Phase 4: batchTestSimilar() - group and test similar elements
  // Phase 5: revertAll() - restore all original text
  // Phase 6: handleShadowDOM() - support web components
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new OverflowScoutContent());
} else {
  new OverflowScoutContent();
}
