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
import { TextPatternType } from '@/lib/textPatterns';
import { detectOverflow, getOverflowSeverity } from '@/lib/overflowDetector';
import { createHighlight, removeHighlight } from '@/lib/highlighter';
import { processInBatches } from '@/lib/batchProcessor';
import { findSimilarElements, groupAllElementsByType, filterTextableElements, getBestGroup } from '@/lib/elementGrouper';
import { StateManager } from '@/lib/stateManager';
import { updateSessionBanner, removeSessionBanner } from '@/lib/sessionBanner';
import { logShadowDOMStructure } from '@/lib/shadowDomHelper';
import { spaObserver } from '@/lib/spaObserver';
import { ErrorHandler } from '@/lib/errorHandler';
import { PerformanceMonitor } from '@/lib/performanceMonitor';
import { InteractiveModeManager } from '@/lib/interactiveMode';
import { generateIntelligentText } from '@/lib/intelligentTextGenerator';
import { AutoScanner } from '@/lib/autoScanner';
import { createAutoBadge, createResultsPanel, removeResultsPanel, isPanelOpen } from '@/lib/autoBadge';

/**
 * Cache structure for storing original element state
 */
interface ElementCache {
  element: HTMLElement;
  originalValue: string;
  originalHTML?: string;  // Phase 7: Store original HTML structure
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
  private interactiveMode = new InteractiveModeManager(); // Phase 9: Point & Click
  private varietyCounter = 0; // Phase 9: For varied text generation
  private autoScanner = new AutoScanner(); // Phase 10: Auto-scan

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

      case MessageType.TOGGLE_INTERACTIVE_MODE:
        return this.toggleInteractiveMode(message.payload);

      case MessageType.AUTO_SCAN:
        return this.runAutoScan();

      default:
        Logger.warn('Unknown message type:', message.type);
        return { error: 'Unknown message type' };
    }
  }

  /**
   * Phase 10: Run auto-scan and show results
   */
  private async runAutoScan(): Promise<{ success: boolean; issueCount: number }> {
    try {
      Logger.info('Running auto-scan...');
      
      // Run the scan
      const issues = await this.autoScanner.scan({
        sampleSize: 100,
        includeHidden: false,
      });
      
      Logger.info(`Auto-scan complete: ${issues.length} issues found`);
      
      // Show badge with count
      createAutoBadge(issues.length, () => {
        // Toggle panel on click
        if (isPanelOpen()) {
          removeResultsPanel();
        } else {
          createResultsPanel(issues, () => {
            removeResultsPanel();
          });
        }
      });
      
      // Auto-open panel if issues found
      if (issues.length > 0) {
        createResultsPanel(issues, () => {
          removeResultsPanel();
        });
      }
      
      return {
        success: true,
        issueCount: issues.length,
      };
    } catch (error) {
      Logger.error('Auto-scan failed:', error);
      return {
        success: false,
        issueCount: 0,
      };
    }
  }

  /**
   * Phase 9: Toggle interactive point & click mode
   */
  private toggleInteractiveMode(payload: any): { success: boolean } {
    try {
      const active = payload?.active || false;
      
      if (active) {
        // Activate interactive mode - click to add element to sidebar
        this.interactiveMode.activate((element: HTMLElement) => {
          Logger.info('Interactive click on element:', element.tagName);
          
          // Send element to sidebar (don't modify it yet)
          window.postMessage({ 
            type: 'OVERFLOW_SCOUT_ADD_ELEMENT',
            element: this.serializeElement(element)
          }, '*');
        });
        Logger.info('Interactive mode activated');
      } else {
        // Deactivate interactive mode
        this.interactiveMode.deactivate();
        Logger.info('Interactive mode deactivated');
      }
      
      return { success: true };
    } catch (error) {
      Logger.error('Error toggling interactive mode:', error);
      return { success: false };
    }
  }
  
  /**
   * Phase 9: Serialize element info for sidebar
   */
  private serializeElement(element: HTMLElement): any {
    const elementType = this.detectElementType(element);
    
    // Get text content
    let originalText = '';
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      originalText = element.value || element.placeholder || '';
    } else {
      originalText = element.textContent || '';
    }
    
    // Generate selector
    let selector = '';
    if (element.id) {
      selector = `#${element.id}`;
    } else if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).slice(0, 2).join('.');
      selector = classes ? `${element.tagName.toLowerCase()}.${classes}` : element.tagName.toLowerCase();
    } else {
      selector = element.tagName.toLowerCase();
    }
    
    // Store reference
    const elementId = this.getElementId(element);
    
    return {
      elementId,
      selector,
      tagName: element.tagName.toLowerCase(),
      originalText: originalText.substring(0, 100),
      elementType
    };
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
   * Phase 7: Revert element to original state (fully restored)
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
    
    // Phase 7: Fully restore original state
    this.revertElementToOriginal(this.lastClickedElement, cache);
    
    // Phase 3-5: Remove highlight and cleanup
    removeHighlight(this.lastClickedElement);
    
    // Phase 5: Remove from state manager
    this.stateManager.removeState(elementId);
    
    // Clean up
    this.elementCache.delete(elementId);
    this.lastClickedElement.removeAttribute('data-overflow-scout-id');
    this.lastClickedElement.removeAttribute('data-overflow-scout-highlighted');
    
    // Update banner
    this.updateBanner();

    Logger.info('Reverted element:', elementId);

    return { success: true, message: 'Reverted to original' };
  }

  /**
   * Phase 7: Fully restore element to original state
   */
  private revertElementToOriginal(element: HTMLElement, cache: ElementCache): void {
    const type = cache.elementType;
    
    if (type === ElementType.INPUT || type === ElementType.TEXTAREA) {
      (element as HTMLInputElement | HTMLTextAreaElement).value = cache.originalValue;
    } else if (type === ElementType.PLACEHOLDER) {
      (element as HTMLInputElement).placeholder = cache.originalValue;
    } else if (type === ElementType.ARIA_LABEL) {
      element.setAttribute('aria-label', cache.originalValue);
    } else if (element.hasAttribute('title')) {
      element.setAttribute('title', cache.originalValue);
    } else if (element.hasAttribute('alt')) {
      element.setAttribute('alt', cache.originalValue);
    } else if (cache.originalHTML) {
      // Phase 7: Restore full HTML structure (preserves icons, styling, etc.)
      element.innerHTML = cache.originalHTML;
    } else {
      // Fallback to textContent
      element.textContent = cache.originalValue;
    }
  }

  /**
   * Phase 7: Find the actual text-bearing element (innermost text node)
   */
  private findTextHost(element: HTMLElement): HTMLElement | null {
    // Handle form inputs - these are always the target
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      return element;
    }

    // Handle contenteditable - these are always the target
    if (element.isContentEditable) {
      return element;
    }

    // Phase 6: Enhanced ARIA attribute support - check first
    if (this.hasARIAText(element)) {
      return element;
    }

    // Phase 7: Find the innermost element with direct text content
    // This prevents targeting wrapper divs and preserves child structure
    const innermost = this.findInnermostTextElement(element);
    if (innermost) {
      return innermost;
    }

    // Fallback: if element has text content, use it
    if (element.textContent && element.textContent.trim()) {
      return element;
    }

    return null;
  }

  /**
   * Phase 7: Find the innermost element that contains direct text (not just in children)
   */
  private findInnermostTextElement(element: HTMLElement): HTMLElement | null {
    // Check if this element has direct text nodes (not just in children)
    let hasDirectText = false;
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        hasDirectText = true;
        break;
      }
    }

    // If this element has direct text and no text-bearing children, it's the target
    if (hasDirectText) {
      // Check if any children also have text - if so, prefer the child
      for (const child of Array.from(element.children)) {
        const htmlChild = child as HTMLElement;
        const childResult = this.findInnermostTextElement(htmlChild);
        if (childResult) {
          return childResult; // Prefer deeper child
        }
      }
      return element; // This is the innermost
    }

    // No direct text, check children
    for (const child of Array.from(element.children)) {
      const htmlChild = child as HTMLElement;
      const result = this.findInnermostTextElement(htmlChild);
      if (result) {
        return result;
      }
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
      originalHTML: (type === ElementType.INPUT || type === ElementType.TEXTAREA || type === ElementType.PLACEHOLDER || type === ElementType.ARIA_LABEL) ? undefined : element.innerHTML,
    });

    return originalValue;
  }

  /**
   * Phase 7: Set text on an element based on its type (preserves structure)
   * IMPORTANT: Only modifies text content, preserves child elements like icons
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
      // Phase 7: Smart text replacement that preserves child elements
      this.setTextPreservingChildren(element, text);
    }
  }

  /**
   * Phase 7: Set text while preserving child elements (icons, SVGs, etc.)
   */
  private setTextPreservingChildren(element: HTMLElement, text: string): void {
    // Find all direct text nodes
    const textNodes: Text[] = [];
    const childNodes = Array.from(element.childNodes);
    for (const node of childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        textNodes.push(node as Text);
      }
    }

    if (textNodes.length > 0) {
      // Replace first text node, remove others
      textNodes[0].textContent = text;
      for (let i = 1; i < textNodes.length; i++) {
        textNodes[i].textContent = '';
      }
    } else {
      // No text nodes found, check if element has only one text-bearing child
      const textChild = this.findTextChild(element);
      if (textChild) {
        textChild.textContent = text;
      } else {
        // Fallback: prepend text node to preserve existing children
        element.insertBefore(document.createTextNode(text + ' '), element.firstChild);
      }
    }
  }

  /**
   * Phase 7: Find the child element that contains the main text
   */
  private findTextChild(element: HTMLElement): HTMLElement | null {
    const children = Array.from(element.children);
    for (const child of children) {
      const htmlChild = child as HTMLElement;
      // Common text-bearing elements in buttons/links
      if (htmlChild.tagName === 'SPAN' || htmlChild.tagName === 'DIV') {
        if (htmlChild.textContent && htmlChild.textContent.trim()) {
          return htmlChild;
        }
      }
    }
    return null;
  }

  /**
   * Phase 9: Intelligent text generation with variety
   * Returns varied, realistic, context-appropriate test strings
   */
  private generateTestString(type: ElementType, originalText: string = ''): string {
    // Phase 9: Use intelligent generator for realistic, varied text
    const intelligentText = generateIntelligentText(type, originalText, this.varietyCounter++);
    
    // If using non-default language mode, append i18n suffix
    if (this.currentMode !== TextPatternType.DEFAULT) {
      const i18nSuffix = this.getI18nSuffix();
      return `${intelligentText} ${i18nSuffix}`;
    }
    
    return intelligentText;
  }

  /**
   * Phase 9: Get i18n suffix based on current mode
   */
  private getI18nSuffix(): string {
    switch (this.currentMode) {
      case TextPatternType.I18N_GERMAN:
        return 'Übersetzung';
      case TextPatternType.I18N_ARABIC:
        return 'الترجمة';
      case TextPatternType.I18N_CJK:
        return '翻訳';
      case TextPatternType.UGC_COMMENT:
        return '🎉 AWESOME!';
      default:
        return '';
    }
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
   * Phase 4-8: Test all elements of a specific type (with performance monitoring)
   */
  private async testAllByType(type: 'button' | 'heading' | 'input' | 'link'): Promise<BatchTestResult> {
    const stopTimer = PerformanceMonitor.start(`test-all-${type}`);
    
    const result = await ErrorHandler.safely(
      async () => {
        const group = groupAllElementsByType(type);

        if (!group) {
          Logger.warn(`No ${type} elements found`);
          return { total: 0, tested: 0, broken: 0, duration: 0, summary: `No ${type} elements found` };
        }

        Logger.info(`Testing all ${type} elements:`, group.description);

        const textableElements = filterTextableElements(group.elements);
        
        // Phase 8: Warn if testing large number of elements
        if (textableElements.length > 500) {
          Logger.warn(`Testing ${textableElements.length} elements - this may take a moment`);
        }
        
        return this.batchTestElements(textableElements, group.description);
      },
      { total: 0, tested: 0, broken: 0, duration: 0, summary: 'Error during testing' },
      `test-all-${type}`
    );
    
    stopTimer();
    return result;
  }

  /**
   * Phase 8: Batch test multiple elements with performance optimization
   */
  private async batchTestElements(elements: HTMLElement[], description: string): Promise<BatchTestResult> {
    let brokenCount = 0;
    const startTime = performance.now();
    
    // Phase 8: Use optimized batch size
    const optimalBatchSize = PerformanceMonitor.getOptimalBatchSize(elements.length);

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
      optimalBatchSize, // Phase 8: Optimized batch size
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
        const cache = this.elementCache.get(state.elementId);
        if (cache) {
          // Phase 7: Fully restore original state
          this.revertElementToOriginal(state.element, cache);
        } else {
          // Fallback if cache not found
          this.setElementText(state.element, state.elementType, state.originalValue);
        }
        
        // Remove highlight
        removeHighlight(state.element);
        
        // Clean up all attributes
        state.element.removeAttribute('data-overflow-scout-id');
        state.element.removeAttribute('data-overflow-scout-highlighted');
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
      interactiveModeActive: this.interactiveMode.isActive(), // Phase 9
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
