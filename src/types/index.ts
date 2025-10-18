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
  
  // Phase 3 - Detection
  DETECT_OVERFLOW = 'DETECT_OVERFLOW',
  
  // Phase 4 - Batch Testing
  TEST_ALL_SIMILAR = 'TEST_ALL_SIMILAR',
  TEST_ALL_BUTTONS = 'TEST_ALL_BUTTONS',
  TEST_ALL_HEADINGS = 'TEST_ALL_HEADINGS',
  TEST_ALL_INPUTS = 'TEST_ALL_INPUTS',
  TEST_ALL_LINKS = 'TEST_ALL_LINKS',
  
  // Phase 5 - State Management
  REVERT_ALL = 'REVERT_ALL',
  GET_STATE = 'GET_STATE',
  
  // Phase 7 - Popup UI
  SET_MODE = 'SET_MODE',
  GET_SETTINGS = 'GET_SETTINGS',
  BATCH_TEST_PAGE = 'BATCH_TEST_PAGE',
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
 * Phase 4: Batch testing results
 */
export interface BatchTestResult {
  total: number;
  tested: number;
  broken: number;
  duration: number;
  summary: string;
}

/**
 * Phase 7-9: Settings and modes
 */
export enum TestMode {
  DEFAULT = 'default',
  GERMAN = 'german',
  ARABIC = 'arabic',
  CJK = 'cjk',
  UGC = 'ugc',
  MIXED = 'mixed',
}

export enum InjectionMode {
  GHOST = 'ghost',         // Non-destructive CSS overlay (default for batch)
  INLINE = 'inline',       // Replace actual text (single element)
  CLONE = 'clone',         // Measure with clone only (no visual change)
}

export enum BatchMode {
  VIEWPORT = 'viewport',   // Only test viewport elements
  SAMPLED = 'sampled',     // Test sample of elements
  ALL = 'all',            // Test everything
}

export interface Settings {
  mode: TestMode;
  injectionMode: InjectionMode;
  batchMode: BatchMode;
  targetSelector?: string;
  samplePercentage?: number;
}

export interface PopupStats {
  isActive: boolean;
  totalTested: number;
  totalBroken: number;
  sessionDuration: number;
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
 * Phase 3: Overflow detection results
 */
export enum OverflowType {
  NONE = 'none',
  CLIPPING = 'clipping',
  ELLIPSIS = 'ellipsis',
  LINE_CLAMP = 'line_clamp',
  WRAPPING = 'wrapping',
  SCROLLABLE = 'scrollable',
}

export interface OverflowDetection {
  hasOverflow: boolean;
  types: OverflowType[];
  details: {
    isClipped?: boolean;
    hasEllipsis?: boolean;
    hasLineClamp?: boolean;
    isWrapping?: boolean;
    isScrollable?: boolean;
    scrollWidth?: number;
    clientWidth?: number;
    scrollHeight?: number;
    clientHeight?: number;
    computedStyle?: {
      overflow?: string;
      overflowX?: string;
      overflowY?: string;
      textOverflow?: string;
      whiteSpace?: string;
      webkitLineClamp?: string;
    };
  };
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
