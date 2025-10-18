# Phase 1 Testing Guide

## Features Implemented

✅ **Context Menu**
- "Test with long text" - Injects test string into clicked element
- "Revert to original" - Restores original text

✅ **Element Detection**
- Finds text host element (not wrapper divs)
- Detects element type (button, heading, input, textarea, etc.)
- Handles form inputs, contenteditable, aria-label, placeholder

✅ **Text Injection**
- Type-aware test strings
- German text for headings
- Long descriptive strings for buttons/text
- Appropriate strings for inputs/textareas

✅ **Caching System**
- Stores original text before injection
- Assigns unique ID to each modified element
- Tracks element type for proper restoration

✅ **Revert Functionality**
- Restores original text
- Cleans up cache and element IDs
- Works on last clicked element

## How to Test

### 1. Rebuild and Reload Extension

```bash
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions/`
2. Click **Reload** icon on Overflow Scout
3. Visit any website

### 2. Test on Different Element Types

#### **Test Buttons**
1. Right-click any button
2. Select "Overflow Scout" → "Test with long text"
3. Button text should change to: "Internationalization and Localization"
4. Right-click same button → "Revert to original"
5. Original text should restore

#### **Test Headings (h1-h6)**
1. Right-click a heading
2. Select "Test with long text"
3. Heading should show German text: "Übersetzung und Internationalisierung..."
4. Revert to restore

#### **Test Paragraph/Span Text**
1. Right-click regular text
2. Test with long text
3. Should see: "This is a substantially long text string designed to test overflow..."
4. Revert

#### **Test Input Fields**
1. Right-click an `<input>` element
2. Test with long text
3. Input value should populate with long string
4. Revert clears back to original

#### **Test Textareas**
1. Right-click a `<textarea>`
2. Inject long multiline text
3. Verify overflow behavior
4. Revert

### 3. Console Verification

Open DevTools (F12) and check console for logs:

**On right-click:**
```
[Overflow Scout] Element right-clicked: BUTTON
```

**On inject:**
```
[Overflow Scout] Injected text: {
  elementId: "os-0",
  type: "button",
  original: "Click Me",
  injected: "Internationalization and Localization"
}
```

**On revert:**
```
[Overflow Scout] Reverted element: os-0
```

### 4. Edge Cases to Test

**Empty elements:**
- Right-click empty div → Should handle gracefully

**Nested elements:**
- Right-click deeply nested text → Should find text host

**Already modified:**
- Inject → Inject again → Should re-cache properly
- Inject → Revert → Inject → Should work

**Multiple elements:**
- Inject element A
- Inject element B
- Revert B → Should only revert B
- Revert A → Should work independently

### 5. Test Websites

Good sites for testing various element types:

- **GitHub** - Buttons, headings, inputs
- **Twitter/X** - Text posts, buttons, textareas
- **Gmail** - Input fields, buttons, contenteditable
- **Wikipedia** - Headings, paragraphs, links
- **Any form** - Inputs, textareas, placeholders

## Expected Behavior

### ✅ Success Indicators
- Context menu appears on right-click
- Text changes immediately on inject
- Original text restores perfectly on revert
- Console shows detailed logs
- No errors in console
- Works across different element types

### ❌ Known Limitations (Expected)

These are Phase 1 limitations (will be addressed later):

- No visual highlighting (Phase 3)
- No overflow detection (Phase 3)
- Can only test one element at a time (Phase 4)
- No "test all similar" (Phase 4)
- No "revert all" (Phase 5)
- No shadow DOM support (Phase 6)
- Basic test strings only (Phase 2)

## Troubleshooting

**Context menu doesn't appear:**
- Reload extension
- Check service worker is active (chrome://extensions/)
- Check console for errors

**Text doesn't inject:**
- Check if element can contain text
- Look for console error messages
- Verify element is not in shadow DOM

**Revert doesn't work:**
- Make sure you clicked the same element
- Check if element was actually modified
- Verify cache exists (check console logs)

**Console errors:**
- Share full error message
- Note which element type caused it
- Include page URL if possible

## Success Criteria

Phase 1 is complete when:

- ✅ Right-click → inject works
- ✅ Text changes to appropriate test string
- ✅ Original text is cached
- ✅ Revert restores original perfectly
- ✅ Works on 5+ different element types
- ✅ No console errors on happy path
- ✅ Graceful error messages for edge cases

## Next: Phase 2

Once Phase 1 testing passes, Phase 2 will add:
- Multiple test string patterns (i18n, RTL, UGC)
- Smarter text generation based on context
- Pattern library for different languages
- More realistic overflow scenarios
