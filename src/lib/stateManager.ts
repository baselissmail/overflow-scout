/**
 * Phase 5: State Manager
 * Central state management for test sessions
 */

import { Logger, type OverflowDetection } from '@/types';
import type { ElementType } from '@/types';

export interface ElementState {
  element: HTMLElement;
  elementId: string;
  originalValue: string;
  elementType: ElementType;
  injectedValue: string;
  overflowDetection?: OverflowDetection;
  timestamp: number;
}

export interface SessionStats {
  totalTested: number;
  totalBroken: number;
  sessionStart: number;
  sessionDuration: number;
}

/**
 * Central state manager for tracking all test modifications
 */
export class StateManager {
  private states = new Map<string, ElementState>();
  private sessionStart: number | null = null;
  private isActive = false;

  /**
   * Start a new test session
   */
  startSession(): void {
    if (this.isActive) {
      Logger.warn('Session already active');
      return;
    }

    this.sessionStart = Date.now();
    this.isActive = true;
    Logger.info('Test session started');
  }

  /**
   * End the current test session
   */
  endSession(): void {
    if (!this.isActive) {
      return;
    }

    const duration = this.sessionStart ? Date.now() - this.sessionStart : 0;
    Logger.info('Test session ended:', {
      duration,
      totalTested: this.states.size,
    });

    this.isActive = false;
    this.sessionStart = null;
  }

  /**
   * Add element state to manager
   */
  addState(state: ElementState): void {
    if (!this.isActive) {
      this.startSession();
    }

    this.states.set(state.elementId, state);
  }

  /**
   * Get state for an element
   */
  getState(elementId: string): ElementState | undefined {
    return this.states.get(elementId);
  }

  /**
   * Check if element has been tested
   */
  hasState(elementId: string): boolean {
    return this.states.has(elementId);
  }

  /**
   * Remove state for an element
   */
  removeState(elementId: string): void {
    this.states.delete(elementId);

    // End session if no more states
    if (this.states.size === 0) {
      this.endSession();
    }
  }

  /**
   * Get all states
   */
  getAllStates(): ElementState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get all states with overflow
   */
  getBrokenStates(): ElementState[] {
    return this.getAllStates().filter(
      state => state.overflowDetection?.hasOverflow
    );
  }

  /**
   * Clear all states
   */
  clearAll(): void {
    this.states.clear();
    this.endSession();
  }

  /**
   * Get session statistics
   */
  getStats(): SessionStats {
    const duration = this.sessionStart ? Date.now() - this.sessionStart : 0;

    return {
      totalTested: this.states.size,
      totalBroken: this.getBrokenStates().length,
      sessionStart: this.sessionStart || 0,
      sessionDuration: duration,
    };
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.isActive;
  }

  /**
   * Get element count
   */
  getElementCount(): number {
    return this.states.size;
  }
}
