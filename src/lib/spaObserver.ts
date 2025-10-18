/**
 * Phase 6: SPA Observer
 * Handles dynamic content changes in Single Page Applications
 */

import { Logger } from '@/types';

export type RevalidateCallback = () => void;

/**
 * SPA Observer to detect when content changes
 */
export class SPAObserver {
  private observer: MutationObserver | null = null;
  private callbacks: Set<RevalidateCallback> = new Set();
  private debounceTimer: number | null = null;
  private debounceDelay = 500; // ms

  /**
   * Start observing DOM changes
   */
  start(): void {
    if (this.observer) {
      Logger.warn('SPA Observer already running');
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
      characterData: true,
    });

    Logger.info('SPA Observer started');
  }

  /**
   * Stop observing
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      Logger.info('SPA Observer stopped');
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Add callback to be called when content changes
   */
  onContentChange(callback: RevalidateCallback): void {
    this.callbacks.add(callback);
  }

  /**
   * Remove callback
   */
  offContentChange(callback: RevalidateCallback): void {
    this.callbacks.delete(callback);
  }

  /**
   * Handle mutation events
   */
  private handleMutations(mutations: MutationRecord[]): void {
    // Check if mutations are significant
    const isSignificant = mutations.some(mutation => {
      // New nodes added
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        return true;
      }

      // Text content changed
      if (mutation.type === 'characterData') {
        return true;
      }

      // Visibility changes
      if (mutation.type === 'attributes') {
        const attr = mutation.attributeName;
        if (attr === 'hidden' || attr === 'style' || attr === 'class') {
          return true;
        }
      }

      return false;
    });

    if (isSignificant) {
      this.debouncedNotify();
    }
  }

  /**
   * Notify callbacks with debouncing
   */
  private debouncedNotify(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      Logger.debug('SPA content changed, notifying callbacks');
      this.callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          Logger.error('Callback error:', error);
        }
      });
      this.debounceTimer = null;
    }, this.debounceDelay);
  }

  /**
   * Check if currently observing
   */
  isObserving(): boolean {
    return this.observer !== null;
  }
}

/**
 * Singleton instance
 */
export const spaObserver = new SPAObserver();
