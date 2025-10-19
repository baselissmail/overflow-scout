/**
 * Phase 8: Error Handler
 * Centralized error handling with graceful degradation
 */

import { Logger } from '@/types';

export class ErrorHandler {
  private static errorCount = 0;
  private static maxErrors = 50; // Circuit breaker
  private static cspBlocked = false;

  /**
   * Wrap async operations with error handling
   */
  static async safely<T>(
    operation: () => Promise<T>,
    fallback: T,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, context);
      return fallback;
    }
  }

  /**
   * Wrap sync operations with error handling
   */
  static safelySync<T>(
    operation: () => T,
    fallback: T,
    context: string
  ): T {
    try {
      return operation();
    } catch (error) {
      this.handleError(error, context);
      return fallback;
    }
  }

  /**
   * Handle errors with circuit breaker
   */
  private static handleError(error: unknown, context: string): void {
    this.errorCount++;

    // Log the error
    if (error instanceof Error) {
      Logger.error(`[${context}]`, error.message, error.stack);
      
      // Detect CSP violations
      if (error.message.includes('Content Security Policy') || 
          error.message.includes('CSP') ||
          error.name === 'SecurityError') {
        this.cspBlocked = true;
        Logger.warn('CSP violation detected - some features may be limited');
      }
    } else {
      Logger.error(`[${context}]`, String(error));
    }

    // Circuit breaker: stop if too many errors
    if (this.errorCount >= this.maxErrors) {
      Logger.error('Too many errors - circuit breaker triggered');
      this.disable();
    }
  }

  /**
   * Check if CSP is blocking operations
   */
  static isCSPBlocked(): boolean {
    return this.cspBlocked;
  }

  /**
   * Disable extension after circuit breaker
   */
  private static disable(): void {
    Logger.error('Extension disabled due to excessive errors');
    // Could dispatch event to notify content script to stop
  }

  /**
   * Reset error counter (for testing)
   */
  static reset(): void {
    this.errorCount = 0;
    this.cspBlocked = false;
  }

  /**
   * Get error count
   */
  static getErrorCount(): number {
    return this.errorCount;
  }
}
