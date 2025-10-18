/**
 * Core type definitions for Overflow Scout
 */

export enum MessageType {
  // Phase 0 - Foundation
  PING = 'PING',
  PONG = 'PONG',
  
  // Phase 1 - Single Element Injection (future)
  INJECT_TEXT = 'INJECT_TEXT',
  REVERT_TEXT = 'REVERT_TEXT',
  
  // Phase 3 - Detection (future)
  DETECT_OVERFLOW = 'DETECT_OVERFLOW',
  
  // Phase 4 - Batch Testing (future)
  TEST_ALL_SIMILAR = 'TEST_ALL_SIMILAR',
  
  // Phase 5 - State Management (future)
  REVERT_ALL = 'REVERT_ALL',
  GET_STATE = 'GET_STATE',
}

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface PingMessage extends Message<void> {
  type: MessageType.PING;
}

export interface PongMessage extends Message<{ timestamp: number }> {
  type: MessageType.PONG;
}

/**
 * Extension state (Phase 5+)
 */
export interface ExtensionState {
  activeTab: number | null;
  mode: 'idle' | 'testing';
  testedElements: number;
  brokenElements: number;
}

/**
 * Logger utility for consistent logging across extension
 */
export class Logger {
  private static prefix = '[Overflow Scout]';

  static info(...args: unknown[]): void {
    console.log(this.prefix, ...args);
  }

  static warn(...args: unknown[]): void {
    console.warn(this.prefix, ...args);
  }

  static error(...args: unknown[]): void {
    console.error(this.prefix, ...args);
  }

  static debug(...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.prefix, ...args);
    }
  }
}
