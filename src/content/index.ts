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

import { MessageType, Logger, ElementType, type Message, type OverflowDetection, type BatchTestResult, TestMode } from '@/types';
import {
  TEXT_PATTERNS,
  TextPatternType,
  getTextByLength,
} from '@/lib/textPatterns';
import { detectOverflow, getOverflowSeverity } from '@/lib/overflowDetector';
import { createHighlight, removeHighlight } from '@/lib/highlighter';
import { processInBatches } from '@/lib/batchProcessor';
import { findSimilarElements, groupAllElementsByType, filterTextableElements, getBestGroup } from '@/lib/elementGrouper';
import { StateManager } from '@/lib/stateManager';
import { updateSessionBanner, removeSessionBanner } from '@/lib/sessionBanner';
import { logShadowDOMStructure } from '@/lib/shadowDomHelper';
import { spaObserver } from '@/lib/spaObserver';

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
  private stateManager = new StateManager();
  private currentMode = TextPatternType.DEFAULT; // Phase 7: Default to English

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

    // Phase 7: Don't run on extension pages (popup, options, etc.)
    if (window.location.protocol === 'chrome-extension:') {
      Logger.info('Skipping initialization on extension page');
      return;
    }

    Logger.info('Content script initialized on', window.location.href);
    
    this.setupMessageHandlers();
    this.setupClickTracking();
    this.setupDOMObserver();
    this.setupSPAObserver();
    this.loadSettings();
    this.notifyBackgroundReady();
    
    // Phase 6: Log Shadow DOM info
    logShadowDOMStructure();
    
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

      case MessageType.TEST_ALL_SIMILAR:
        return this.testAllSimilar();

      case MessageType.TEST_ALL_BUTTONS:
        return this.testAllByType('button');

      case MessageType.TEST_ALL_HEADINGS:
        return this.testAllByType('heading');

      case MessageType.TEST_ALL_INPUTS:
        return this.testAllByType('input');

      case MessageType.TEST_ALL_LINKS:
        return this.testAllByType('link');

      case MessageType.REVERT_ALL:
        return this.revertAll();

      case MessageType.GET_STATE:
        return this.getState();

      case MessageType.SET_MODE:
        return this.setMode(message.payload);

      default:
        Logger.warn('Unknown message type in content:', message.type);
        return { error: 'Unknown message type' };
    }
  }

  /**
   * Phase 6: Set up MutationObserver for SPA re-render handling
   */
  private setupDOMObserver(): void {
    // Placeholder for future enhancements
  }

  /**
   * Phase 6: Set up SPA observer to handle dynamic content
   */
  private setupSPAObserver(): void {
    spaObserver.start();
    
    // React to content changes
    spaObserver.onContentChange(() => {
      Logger.debug('SPA content changed, checking for lost highlights');
      this.revalidateHighlights();
    });
  }

  /**
   * Phase 6: Revalidate highlights after SPA navigation
   */
  private revalidateHighlights(): void {
    const states = this.stateManager.getAllStates();
    
    for (const state of states) {
      // Check if element still exists in DOM
      if (!document.body.contains(state.element)) {
        Logger.warn('Element removed from DOM:', state.elementId);
        this.stateManager.removeState(state.elementId);
        this.elementCache.delete(state.elementId);
      }
    }
    
    // Update banner with current count
    this.updateBanner();
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

    // Phase 3-5: Detect overflow and update state
    // Wait for layout to settle
    requestAnimationFrame(() => {
      const detection = detectOverflow(textHost);
      const elementId = this.getElementId(textHost);
      
      // Store detection results in cache
      const cache = this.elementCache.get(elementId);
      if (cache) {
        cache.overflowDetection = detection;
        
        // Phase 5: Add to state manager
        this.stateManager.addState({
          element: textHost,
          elementId,
          originalValue: original,
          elementType,
          injectedValue: testString,
          overflowDetection: detection,
          timestamp: Date.now(),
        });
        
        // Update session banner
        this.updateBanner();
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
    
    // Phase 3-5: Remove highlight and cleanup
    removeHighlight(this.lastClickedElement);
    
    // Phase 5: Remove from state manager
    this.stateManager.removeState(elementId);
    
    // Clean up
    this.elementCache.delete(elementId);
    this.lastClickedElement.removeAttribute('data-overflow-scout-id');
    
    // Update banner
    this.updateBanner();

    Logger.info('Reverted element:', elementId);

    return { success: true, message: 'Reverted to original' };
  }

  /**
   * Phase 6: Find the actual text-bearing element (including ARIA attributes)
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

    // Phase 6: Enhanced ARIA attribute support
    if (this.hasARIAText(element)) {
      return element;
    }

    return null;
  }

  /**
   * Phase 6: Check if element has ARIA text (when visible text absent)
   */
  private hasARIAText(element: HTMLElement): boolean {
    // Check aria-label
    if (element.getAttribute('aria-label')) {
      return true;
    }

    // Check title attribute
    if (element.getAttribute('title')) {
      return true;
    }

    // Check alt attribute (for images)
    if (element.getAttribute('alt')) {
      return true;
    }

    // Check aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement && labelElement.textContent) {
        return true;
      }
    }

    // Check placeholder
    if (element.getAttribute('placeholder')) {
      return true;
    }

    return false;
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
   * Phase 6: Set text on an element based on its type (enhanced for ARIA)
   */
  private setElementText(element: HTMLElement, type: ElementType, text: string): void {
    if (type === ElementType.INPUT || type === ElementType.TEXTAREA) {
      (element as HTMLInputElement | HTMLTextAreaElement).value = text;
    } else if (type === ElementType.PLACEHOLDER) {
      (element as HTMLInputElement).placeholder = text;
    } else if (type === ElementType.ARIA_LABEL) {
      element.setAttribute('aria-label', text);
    } else if (element.hasAttribute('title')) {
      // Phase 6: Support title attribute
      element.setAttribute('title', text);
    } else if (element.hasAttribute('alt')) {
      // Phase 6: Support alt attribute
      element.setAttribute('alt', text);
    } else {
      element.textContent = text;
    }
  }

  /**
   * Phase 7: Smart text generation with pattern library
   * Returns varied, realistic, context-appropriate test strings
   * Now respects mode selection and ensures test is LONGER
   */
  private generateTestString(type: ElementType, originalText: string = ''): string {
    // Phase 7: For component-specific types, use current mode instead of random
    // This ensures mode selection is respected everywhere
    switch (type) {
      case ElementType.BUTTON:
      case ElementType.BUTTON_SUBMIT:
      case ElementType.LINK:
      case ElementType.LABEL:
      case ElementType.PLACEHOLDER:
      case ElementType.HEADING:
      case ElementType.NOTIFICATION:
      case ElementType.BREADCRUMB:
        // Use current mode for all UI components
        return getTextByLength(TEXT_PATTERNS[this.currentMode], 'medium');

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
      case ElementType.TEXTAREA:
      case ElementType.CONTENTEDITABLE:
      case ElementType.ARIA_LABEL:
        // Use current mode for text inputs
        return getTextByLength(TEXT_PATTERNS[this.currentMode], 'long');

      // Default text patterns - use current mode
      case ElementType.TEXT:
      default:
        return this.selectTextPattern(originalText);
    }
  }

  /**
   * Phase 7: Select pattern type based on mode and original length
   */
  private selectTextPattern(originalText: string): string {
    const originalLength = originalText.trim().length;

    // If original is already long (>50 chars), test with even longer text
    if (originalLength > 50) {
      return getTextByLength(TEXT_PATTERNS[this.currentMode], 'long');
    }

    // Use current mode
    return getTextByLength(TEXT_PATTERNS[this.currentMode], 'long');
  }


  /**
   * Phase 4: Test all elements similar to the clicked one
   */
  private async testAllSimilar(): Promise<BatchTestResult> {
    if (!this.lastClickedElement) {
      Logger.warn('No element selected for batch testing');
      return { total: 0, tested: 0, broken: 0, duration: 0, summary: 'No element selected' };
    }

    const groups = findSimilarElements(this.lastClickedElement);
    const bestGroup = getBestGroup(groups);

    if (!bestGroup) {
      Logger.warn('No similar elements found');
      return { total: 0, tested: 0, broken: 0, duration: 0, summary: 'No similar elements found' };
    }

    Logger.info(`Testing ${bestGroup.elements.length} similar elements:`, bestGroup.description);

    const textableElements = filterTextableElements(bestGroup.elements);
    return this.batchTestElements(textableElements, bestGroup.description);
  }

  /**
   * Phase 4: Test all elements of a specific type
   */
  private async testAllByType(type: 'button' | 'heading' | 'input' | 'link'): Promise<BatchTestResult> {
    const group = groupAllElementsByType(type);

    if (!group) {
      Logger.warn(`No ${type} elements found`);
      return { total: 0, tested: 0, broken: 0, duration: 0, summary: `No ${type} elements found` };
    }

    Logger.info(`Testing all ${type} elements:`, group.description);

    const textableElements = filterTextableElements(group.elements);
    return this.batchTestElements(textableElements, group.description);
  }

  /**
   * Phase 4: Batch test multiple elements with rAF scheduling
   */
  private async batchTestElements(elements: HTMLElement[], description: string): Promise<BatchTestResult> {
    let brokenCount = 0;
    const startTime = performance.now();

    // Process elements in batches to avoid jank
    const result = await processInBatches(
      elements,
      (element) => {
        // Skip if already tested
        const elementId = element.getAttribute('data-overflow-scout-id');
        if (elementId && this.elementCache.has(elementId)) {
          return; // Already tested
        }

        const textHost = this.findTextHost(element);
        if (!textHost) return;

        const elementType = this.detectElementType(textHost);
        const original = this.cacheOriginalValue(textHost, elementType);
        const testString = this.generateTestString(elementType, original);

        // Inject
        this.setElementText(textHost, elementType, testString);

        // Detect overflow after layout settles
        requestAnimationFrame(() => {
          const detection = detectOverflow(textHost);
          const id = this.getElementId(textHost);
          const cache = this.elementCache.get(id);
          if (cache) {
            cache.overflowDetection = detection;
            
            // Phase 5: Add to state manager
            this.stateManager.addState({
              element: textHost,
              elementId: id,
              originalValue: original,
              elementType,
              injectedValue: testString,
              overflowDetection: detection,
              timestamp: Date.now(),
            });
            
            // Update banner
            this.updateBanner();
          }

          if (detection.hasOverflow) {
            createHighlight(textHost, detection, original, testString);
            brokenCount++;
          }
        });
      },
      10, // Batch size
      (current, total) => {
        Logger.debug(`Progress: ${current}/${total}`);
      }
    );

    const duration = performance.now() - startTime;
    const summary = `${description}: ${brokenCount}/${result.processed} broken`;

    Logger.info('Batch test complete:', {
      total: result.processed,
      broken: brokenCount,
      duration,
    });

    return {
      total: result.processed,
      tested: result.processed,
      broken: brokenCount,
      duration,
      summary,
    };
  }

  /**
   * Phase 5: Revert all tested elements to original state
   */
  private revertAll(): { success: boolean; count: number; message: string } {
    const states = this.stateManager.getAllStates();
    
    if (states.length === 0) {
      Logger.info('No elements to revert');
      return { success: true, count: 0, message: 'No elements to revert' };
    }

    let reverted = 0;

    for (const state of states) {
      try {
        // Revert text
        this.setElementText(state.element, state.elementType, state.originalValue);
        
        // Remove highlight
        removeHighlight(state.element);
        
        // Clean up
        state.element.removeAttribute('data-overflow-scout-id');
        this.elementCache.delete(state.elementId);
        
        reverted++;
      } catch (error) {
        Logger.error('Failed to revert element:', state.elementId, error);
      }
    }

    // Clear all state
    this.stateManager.clearAll();
    
    // Remove banner
    removeSessionBanner();

    Logger.info(`Reverted ${reverted}/${states.length} elements`);

    return {
      success: true,
      count: reverted,
      message: `Reverted ${reverted} element(s) to original`,
    };
  }

  /**
   * Phase 5: Get current session state
   */
  private getState(): object {
    const stats = this.stateManager.getStats();
    const states = this.stateManager.getAllStates();

    return {
      isActive: this.stateManager.isSessionActive(),
      stats,
      elementCount: states.length,
      brokenCount: this.stateManager.getBrokenStates().length,
    };
  }

  /**
   * Phase 5: Update session banner with current stats
   */
  private updateBanner(): void {
    const stats = this.stateManager.getStats();
    
    if (stats.totalTested > 0) {
      updateSessionBanner({
        totalTested: stats.totalTested,
        totalBroken: stats.totalBroken,
        onRevertAll: () => {
          this.revertAll();
        },
      });
    } else {
      removeSessionBanner();
    }
  }

  /**
   * Phase 7: Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['mode']);
      const mode = result.mode || TestMode.DEFAULT;
      this.setModeFromTestMode(mode);
      Logger.info('Loaded mode:', mode);
    } catch (error) {
      Logger.error('Failed to load settings:', error);
    }
  }

  /**
   * Phase 7: Set mode from popup
   */
  private setMode(payload: any): { success: boolean } {
    if (!payload || !payload.mode) {
      return { success: false };
    }

    this.setModeFromTestMode(payload.mode);
    Logger.info('Mode changed to:', payload.mode);
    
    return { success: true };
  }

  /**
   * Phase 7: Convert TestMode to TextPatternType
   */
  private setModeFromTestMode(mode: TestMode): void {
    switch (mode) {
      case TestMode.DEFAULT:
        this.currentMode = TextPatternType.DEFAULT;
        break;
      case TestMode.GERMAN:
        this.currentMode = TextPatternType.I18N_GERMAN;
        break;
      case TestMode.ARABIC:
        this.currentMode = TextPatternType.I18N_ARABIC;
        break;
      case TestMode.CJK:
        this.currentMode = TextPatternType.I18N_CJK;
        break;
      case TestMode.UGC:
        this.currentMode = TextPatternType.UGC_COMMENT;
        break;
      case TestMode.MIXED:
      default:
        // For mixed mode, keep random selection behavior
        this.currentMode = this.getRandomMode();
        break;
    }
  }

  /**
   * Phase 7: Get random mode for mixed testing
   */
  private getRandomMode(): TextPatternType {
    const modes = [
      TextPatternType.DEFAULT,
      TextPatternType.I18N_GERMAN,
      TextPatternType.I18N_ARABIC,
      TextPatternType.I18N_CJK,
      TextPatternType.UGC_COMMENT,
    ];
    return modes[Math.floor(Math.random() * modes.length)];
  }

  // Future phase methods:
  // Phase 8: Polish and edge cases
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new OverflowScoutContent());
} else {
  new OverflowScoutContent();
}
