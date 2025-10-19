/**
 * Auto-Scanner - Passive Monitoring Mode
 * Automatically detects overflow issues without modifying the page
 */

import { ElementType } from '@/types';
import { detectOverflow } from './overflowDetector';
import { generateIntelligentText } from './intelligentTextGenerator';
import { measureWithClone } from './cloneMeasurement';

export interface OverflowIssue {
  element: HTMLElement;
  selector: string;
  originalText: string;
  testText: string;
  overflowType: string[];
  severity: 'low' | 'medium' | 'high';
  cssIssues: string[];
  suggestedFixes: string[];
  screenshot?: string;
}

export class AutoScanner {
  private issues: OverflowIssue[] = [];
  private scannedElements = new WeakSet<HTMLElement>();
  private scanning = false;
  private varietyCounter = 0;

  /**
   * Start auto-scanning the page
   */
  async scan(options: { sampleSize?: number; includeHidden?: boolean } = {}): Promise<OverflowIssue[]> {
    if (this.scanning) {
      console.warn('[AutoScanner] Scan already in progress');
      return this.issues;
    }

    this.scanning = true;
    this.issues = [];
    this.scannedElements = new WeakSet();
    this.varietyCounter = 0;

    console.time('[AutoScanner] Full scan');

    // Get all testable elements
    const elements = this.getAllTestableElements(options.includeHidden);
    
    // Sample if too many
    const sampleSize = options.sampleSize || 100;
    const elementsToTest = elements.length > sampleSize 
      ? this.sampleElements(elements, sampleSize)
      : elements;

    console.log(`[AutoScanner] Testing ${elementsToTest.length} elements (of ${elements.length} total)`);

    // Test in batches to avoid blocking UI
    await this.testElementsInBatches(elementsToTest);

    console.timeEnd('[AutoScanner] Full scan');
    console.log(`[AutoScanner] Found ${this.issues.length} overflow issues`);

    this.scanning = false;
    return this.issues;
  }

  /**
   * Get all testable elements from page
   */
  private getAllTestableElements(includeHidden = false): HTMLElement[] {
    const elements: HTMLElement[] = [];
    
    // Selectors for elements that commonly have text
    const selectors = [
      'button',
      'a',
      'h1, h2, h3, h4, h5, h6',
      'p',
      'span',
      'div[class]', // Only divs with classes (likely components)
      'label',
      'input[type="text"]',
      'input[type="email"]',
      'input[type="url"]',
      'textarea',
      '.btn, .button',
      '[role="button"]',
      '[role="link"]',
    ];

    selectors.forEach(selector => {
      try {
        const found = document.querySelectorAll(selector);
        found.forEach(el => {
          if (el instanceof HTMLElement) {
            // Skip if already scanned
            if (this.scannedElements.has(el)) return;
            
            // Skip if no text content
            const text = this.getElementText(el);
            if (!text || text.trim().length === 0) return;
            
            // Skip if hidden (unless includeHidden is true)
            if (!includeHidden && !this.isVisible(el)) return;
            
            // Skip if too large (likely not a component)
            if (el.offsetWidth > 1000 || el.offsetHeight > 500) return;
            
            elements.push(el);
            this.scannedElements.add(el);
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });

    return elements;
  }

  /**
   * Test elements in batches to avoid blocking
   */
  private async testElementsInBatches(elements: HTMLElement[]): Promise<void> {
    const batchSize = 20;
    
    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);
      
      // Process batch
      batch.forEach(el => this.testElement(el));
      
      // Yield to browser
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    }
  }

  /**
   * Test single element for overflow
   */
  private testElement(element: HTMLElement): void {
    try {
      // Double-check visibility before testing
      if (!this.isVisible(element)) {
        return; // Skip hidden elements
      }
      
      // Skip elements that are just containers for other elements
      // (e.g., div containing mat-icon, span containing svg, etc.)
      if (this.isContainerElement(element)) {
        return;
      }
      
      const elementType = this.classifyElement(element);
      const originalText = this.getElementText(element);
      
      if (!originalText) return;

      // Generate realistic test text
      const testText = generateIntelligentText(elementType, originalText, this.varietyCounter++);
      
      // Test with clone (non-destructive!)
      const hasOverflow = measureWithClone(element, testText, elementType);
      
      if (hasOverflow) {
        // Analyze the issue
        const issue = this.analyzeOverflow(element, elementType, originalText, testText);
        this.issues.push(issue);
      }
    } catch (e) {
      // Silently skip problematic elements
    }
  }
  
  /**
   * Check if element is just a container for other interactive/styled elements
   */
  private isContainerElement(element: HTMLElement): boolean {
    // Skip if element has child elements (not just text nodes)
    const childElements = Array.from(element.children);
    
    if (childElements.length === 0) {
      return false; // No children, it's a text element
    }
    
    // Check if all text content comes from child elements
    const directTextContent = Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent?.trim() || '')
      .join('')
      .trim();
    
    // If element has child elements and no direct text content, it's a container
    if (childElements.length > 0 && !directTextContent) {
      return true;
    }
    
    // Skip specific container patterns (mat-icon parent, svg parent, etc.)
    const hasSpecialChildren = childElements.some(child => {
      const tagName = child.tagName.toLowerCase();
      return tagName === 'svg' || 
             tagName === 'mat-icon' || 
             tagName === 'i' && child.className.includes('icon') ||
             tagName === 'img';
    });
    
    return hasSpecialChildren;
  }

  /**
   * Analyze overflow and generate actionable info
   */
  private analyzeOverflow(
    element: HTMLElement,
    _elementType: ElementType,
    originalText: string,
    testText: string
  ): OverflowIssue {
    const styles = window.getComputedStyle(element);
    const detection = detectOverflow(element);
    
    // Generate CSS selector
    const selector = this.generateSelector(element);
    
    // Analyze CSS issues
    const cssIssues = this.analyzeCSSIssues(styles, detection);
    
    // Generate fixes
    const suggestedFixes = this.generateFixes(styles, detection, cssIssues);
    
    // Determine severity
    const severity = this.calculateSeverity(detection, element);
    
    return {
      element,
      selector,
      originalText: originalText.substring(0, 50),
      testText: testText.substring(0, 50),
      overflowType: detection.types,
      severity,
      cssIssues,
      suggestedFixes,
    };
  }

  /**
   * Analyze CSS to find root cause
   */
  private analyzeCSSIssues(styles: CSSStyleDeclaration, _detection: any): string[] {
    const issues: string[] = [];
    
    if (styles.overflow === 'hidden' || styles.overflowX === 'hidden') {
      issues.push('overflow: hidden - content is clipped');
    }
    
    if (styles.textOverflow === 'ellipsis') {
      issues.push('text-overflow: ellipsis - text is truncated');
    }
    
    if (styles.whiteSpace === 'nowrap') {
      issues.push('white-space: nowrap - prevents text wrapping');
    }
    
    if (styles.width && styles.width !== 'auto') {
      issues.push(`Fixed width: ${styles.width} - may be too small`);
    }
    
    if (styles.maxWidth && styles.maxWidth !== 'none') {
      issues.push(`Max width: ${styles.maxWidth} - constrains content`);
    }
    
    const webkitLineClamp = (styles as any)['-webkit-line-clamp'];
    if (webkitLineClamp && webkitLineClamp !== 'none') {
      issues.push(`Line clamp: ${webkitLineClamp} - limits to ${webkitLineClamp} lines`);
    }
    
    return issues;
  }

  /**
   * Generate actionable fix suggestions
   */
  private generateFixes(styles: CSSStyleDeclaration, _detection: any, _issues: string[]): string[] {
    const fixes: string[] = [];
    
    if (styles.whiteSpace === 'nowrap') {
      fixes.push('Remove white-space: nowrap to allow wrapping');
      fixes.push('Add overflow-wrap: break-word for long words');
    }
    
    if (styles.overflow === 'hidden' && !styles.textOverflow) {
      fixes.push('Add text-overflow: ellipsis to show truncation');
    }
    
    if (styles.width && styles.width !== 'auto') {
      fixes.push(`Increase width or use min-width instead of fixed width`);
    }
    
    if (styles.display === 'inline' || styles.display === 'inline-block') {
      fixes.push('Consider using display: block or flex for better text handling');
    }
    
    if (fixes.length === 0) {
      fixes.push('Add text-overflow: ellipsis with overflow: hidden');
      fixes.push('Consider using overflow-wrap: break-word');
    }
    
    return fixes;
  }

  /**
   * Calculate severity based on overflow amount and element visibility
   */
  private calculateSeverity(detection: any, element: HTMLElement): 'low' | 'medium' | 'high' {
    const rect = element.getBoundingClientRect();
    const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
    
    // High severity if element is visible and has clipping
    if (isInViewport && detection.types.includes('clipping')) {
      return 'high';
    }
    
    // Medium if ellipsis or line clamp
    if (detection.types.includes('ellipsis') || detection.types.includes('line_clamp')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Generate CSS selector for element
   */
  private generateSelector(element: HTMLElement): string {
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }
    
    // Try class names
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (classes) {
        return `${element.tagName.toLowerCase()}.${classes}`;
      }
    }
    
    // Fallback to tag + nth-child
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element) + 1;
      return `${element.tagName.toLowerCase()}:nth-child(${index})`;
    }
    
    return element.tagName.toLowerCase();
  }

  /**
   * Get text content from element
   */
  private getElementText(element: HTMLElement): string {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value || element.placeholder;
    }
    return element.textContent?.trim() || '';
  }

  /**
   * Classify element type
   */
  private classifyElement(element: HTMLElement): ElementType {
    const tag = element.tagName.toLowerCase();
    
    if (tag === 'button' || element.getAttribute('role') === 'button') {
      return ElementType.BUTTON;
    }
    if (tag === 'a') {
      return ElementType.LINK;
    }
    if (tag.match(/^h[1-6]$/)) {
      return ElementType.HEADING;
    }
    if (tag === 'input') {
      const type = element.getAttribute('type');
      if (type === 'email') return ElementType.INPUT_EMAIL;
      if (type === 'url') return ElementType.INPUT_URL;
      if (type === 'tel') return ElementType.INPUT_TEL;
      if (type === 'search') return ElementType.INPUT_SEARCH;
      return ElementType.INPUT;
    }
    if (tag === 'textarea') {
      return ElementType.TEXTAREA;
    }
    
    return ElementType.TEXT;
  }

  /**
   * Check if element is actually visible to users
   */
  private isVisible(element: HTMLElement): boolean {
    // Check CSS properties
    const styles = window.getComputedStyle(element);
    if (styles.display === 'none') return false;
    if (styles.visibility === 'hidden') return false;
    if (styles.opacity === '0') return false;
    
    // Check if element has dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    
    // Check if element or any parent has display: none or visibility: hidden
    let parent = element.parentElement;
    while (parent) {
      const parentStyles = window.getComputedStyle(parent);
      if (parentStyles.display === 'none') return false;
      if (parentStyles.visibility === 'hidden') return false;
      parent = parent.parentElement;
    }
    
    return true;
  }

  /**
   * Sample elements for large sets
   */
  private sampleElements(elements: HTMLElement[], size: number): HTMLElement[] {
    if (elements.length <= size) return elements;
    
    const step = Math.floor(elements.length / size);
    const sampled: HTMLElement[] = [];
    
    for (let i = 0; i < elements.length && sampled.length < size; i += step) {
      sampled.push(elements[i]);
    }
    
    return sampled;
  }

  /**
   * Get current issues
   */
  getIssues(): OverflowIssue[] {
    return this.issues;
  }

  /**
   * Clear issues
   */
  clear(): void {
    this.issues = [];
  }
}
