/**
 * Core type definitions for Overflow Scout
 */
export var MessageType;
(function (MessageType) {
    // Phase 0 - Foundation
    MessageType["PING"] = "PING";
    MessageType["PONG"] = "PONG";
    // Phase 1 - Single Element Injection
    MessageType["INJECT_TEXT"] = "INJECT_TEXT";
    MessageType["REVERT_TEXT"] = "REVERT_TEXT";
    MessageType["INJECT_SUCCESS"] = "INJECT_SUCCESS";
    MessageType["REVERT_SUCCESS"] = "REVERT_SUCCESS";
    // Phase 3 - Detection (future)
    MessageType["DETECT_OVERFLOW"] = "DETECT_OVERFLOW";
    // Phase 4 - Batch Testing (future)
    MessageType["TEST_ALL_SIMILAR"] = "TEST_ALL_SIMILAR";
    // Phase 5 - State Management (future)
    MessageType["REVERT_ALL"] = "REVERT_ALL";
    MessageType["GET_STATE"] = "GET_STATE";
})(MessageType || (MessageType = {}));
/**
 * Element type for text injection
 */
export var ElementType;
(function (ElementType) {
    ElementType["TEXT"] = "text";
    ElementType["INPUT"] = "input";
    ElementType["TEXTAREA"] = "textarea";
    ElementType["CONTENTEDITABLE"] = "contenteditable";
    ElementType["PLACEHOLDER"] = "placeholder";
    ElementType["ARIA_LABEL"] = "aria_label";
    ElementType["BUTTON"] = "button";
    ElementType["HEADING"] = "heading";
})(ElementType || (ElementType = {}));
/**
 * Logger utility for consistent logging across extension
 */
export class Logger {
    static info(...args) {
        console.log(this.prefix, ...args);
    }
    static warn(...args) {
        console.warn(this.prefix, ...args);
    }
    static error(...args) {
        console.error(this.prefix, ...args);
    }
    static debug(...args) {
        if (process.env.NODE_ENV === 'development') {
            console.debug(this.prefix, ...args);
        }
    }
}
Logger.prefix = '[Overflow Scout]';
