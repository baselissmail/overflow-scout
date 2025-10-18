# Development Guide

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Extension

**Development Mode (with watch & HMR)**
```bash
npm run dev
```
This will rebuild automatically when you edit files. CRXJS provides Hot Module Reload for instant updates.

**Production Build**
```bash
npm run build
```

### 3. Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/` folder from this project
5. The extension should now appear in your toolbar

### 4. Verify Installation

Click the Overflow Scout icon in your toolbar. You should see:
- Status showing "Idle" mode
- Tested/Broken counters at 0
- "Test Connection" button (clickable)

Click "Test Connection" to verify background and content scripts are communicating.

## Development Workflow

### Making Changes

1. Edit source files in `src/`
2. Vite will rebuild automatically (if using `npm run dev`)
3. Go to `chrome://extensions/` 
4. Click the refresh icon on the Overflow Scout card
5. Reload any web pages where you're testing

### Debugging

**Background Script:**
- Go to `chrome://extensions/`
- Click "service worker" under Overflow Scout
- Console logs appear in the DevTools that opens

**Content Script:**
- Open DevTools on any web page (F12)
- Look for `[Overflow Scout]` prefixed logs
- Content script runs on all pages automatically

**Popup:**
- Right-click the extension icon → Inspect Popup
- DevTools will open for the popup

## Architecture Overview

### Communication Flow

```
User Action (Right-click menu)
    ↓
Background Service Worker
    ↓ (sends message)
Content Script (in page context)
    ↓ (manipulates DOM)
DOM Changes (text injection, highlighting)
    ↓ (reports back)
Background → Popup (updates UI)
```

### File Structure

```
src/
├── types/index.ts          # Shared types, enums, Logger
├── background/index.ts     # Service worker, context menus
├── content/index.ts        # DOM manipulation, detection
└── popup/
    ├── index.html          # Popup UI structure
    ├── popup.css           # Styles
    └── popup.ts            # UI controller logic
```

### Adding New Features

1. **Define message types** in `src/types/index.ts`
2. **Add background handlers** in `src/background/index.ts`
3. **Implement content script logic** in `src/content/index.ts`
4. **Update popup UI** in `src/popup/` if needed
5. **Rebuild and test**

## Type Checking

```bash
npm run type-check
```

This runs TypeScript compiler without emitting files, just to check for errors.

## Best Practices

- Always use the `Logger` class for console output
- Define TypeScript types for all message payloads
- Keep async functions properly awaited
- Use `sendResponse` callback pattern for message handlers
- Test on real websites, not just localhost
- Check both manifest v3 service worker lifecycle quirks

## Common Issues

### Extension doesn't load
- Check `dist/` folder exists and contains `manifest.json`
- Verify all file paths in manifest are correct
- Look for errors in `chrome://extensions/` page

### Changes not appearing
- Refresh the extension at `chrome://extensions/`
- Reload the web page you're testing on
- Clear cache if needed

### Service worker inactive
- This is normal in manifest v3
- It wakes up on events (messages, context menu clicks)
- Check "service worker" link to see console

### Content script not injecting
- Check the page URL matches `<all_urls>` pattern
- Some Chrome internal pages block content scripts
- Look for CSP (Content Security Policy) errors

## Phase 1 Preparation

The next phase will implement:
- Active context menu item "Test with long text"
- Element detection on right-click
- Text injection with caching
- Single-element revert

Review `src/content/index.ts` for placeholder methods that will be implemented.
