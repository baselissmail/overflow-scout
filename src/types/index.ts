/**
 * Core type definitions for Overflow Scout
 */

export enum MessageType {
  // Phase 0 - Foundation
  PING = 'PING',
  PONG = 'PONG',
  
  // Phase 1 - Single Element Injection
  INJECT_TEXT = 'INJECT_TEXT',
  REVERT_TEXT = 'REVERT_TEXT',
  INJECT_SUCCESS = 'INJECT_SUCCESS',
  REVERT_SUCCESS = 'REVERT_SUCCESS',
  
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
 * Phase 1: Text injection payloads
 */
export interface InjectTextPayload {
  elementPath?: string;
  testString?: string;
}

export interface InjectSuccessPayload {
  elementId: string;
  originalText: string;
  injectedText: string;
}

export interface RevertTextPayload {
  elementId?: string;
}

/**
 * Element type for text injection (Phase 2: Enhanced)
 */
export enum ElementType {
  TEXT = 'text',
  INPUT = 'input',
  INPUT_EMAIL = 'input_email',
  INPUT_SEARCH = 'input_search',
  INPUT_TEL = 'input_tel',
  INPUT_URL = 'input_url',
  TEXTAREA = 'textarea',
  CONTENTEDITABLE = 'contenteditable',
  PLACEHOLDER = 'placeholder',
  ARIA_LABEL = 'aria_label',
  BUTTON = 'button',
  BUTTON_SUBMIT = 'button_submit',
  LINK = 'link',
  HEADING = 'heading',
  LABEL = 'label',
  NOTIFICATION = 'notification',
  BREADCRUMB = 'breadcrumb',
}

/**
 * Context metadata for smarter text generation
 */
export interface ElementContext {
  type: ElementType;
  role?: string;
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
  inputType?: string;
  tagName?: string;
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
