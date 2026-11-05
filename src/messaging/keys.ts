/**
 * Constants shared by contexts that must stay small (the service worker), so
 * importing them doesn't pull in the message schemas.
 */

/** `chrome.storage.session` key holding the latest gesture, for a panel that is still starting up. */
export const LAST_GESTURE_KEY = 'lastGesture';
