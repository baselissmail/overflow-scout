# Migration to CRXJS Vite Plugin

**Date**: Phase 0  
**Reason**: Eliminate custom build hacks and use purpose-built tooling

## What Changed

### Before (Manual Vite Config)
```typescript
// vite.config.ts - ~70 lines
export default defineConfig({
  build: {
    rollupOptions: {
      input: { background, content, popup },
      output: { 
        entryFileNames: (chunkInfo) => {...}, 
        assetFileNames: (assetInfo) => {...}
      }
    }
  },
  plugins: [
    viteStaticCopy({...}),
    customPopupMoverPlugin // HACK!
  ]
})
```

**Problems:**
- Custom plugin to move popup.html
- Manual file path configuration
- No HMR support
- Complex asset name logic
- Had to clean up temp directories

### After (CRXJS)
```typescript
// vite.config.ts - 15 lines
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: { alias: { '@': resolve(__dirname, 'src') } }
});
```

**Benefits:**
✅ Automatic manifest handling  
✅ HMR (Hot Module Reload) for faster development  
✅ Proper source map support  
✅ Auto-generates loaders for background/content scripts  
✅ No custom plugins needed  
✅ Cleaner build output  

## Manifest Changes

Changed from built paths to source paths:

```diff
{
  "background": {
-   "service_worker": "background.js"
+   "service_worker": "src/background/index.ts"
  },
  "content_scripts": [{
-   "js": ["content.js"]
+   "js": ["src/content/index.ts"]
  }],
  "action": {
-   "default_popup": "popup.html"
+   "default_popup": "src/popup/index.html"
  }
}
```

CRXJS automatically rewrites these paths during build.

## Build Output

### Before
```
dist/
├── background.js
├── content.js
├── popup.html (moved by custom plugin)
├── popup.[hash].js
└── assets/popup.css
```

### After
```
dist/
├── service-worker-loader.js         # Auto-generated
├── assets/
│   ├── index.ts-loader-[hash].js    # Content script loader
│   ├── index.ts-[hash].js           # Content script bundle
│   ├── index.html-[hash].js         # Popup script
│   └── index-[hash].css             # Popup styles
├── src/popup/index.html             # Popup HTML
├── icons/                           # Copied automatically
└── manifest.json                    # Rewritten with correct paths
```

## Dependencies Changed

### Removed
```bash
npm uninstall vite-plugin-static-copy
```

### Added
```bash
npm install --save-dev @crxjs/vite-plugin
```

## Development Workflow Impact

### Hot Module Reload (NEW!)
With `npm run dev`, changes to your code instantly reflect in the extension:
- Edit TypeScript → see changes without manual reload
- Edit CSS → styles update live
- Edit popup HTML → popup refreshes automatically

### No More Manual Steps
- ❌ Before: Build → manually copy files → reload extension
- ✅ After: Save file → changes appear automatically

## Migration Steps (Completed)

1. ✅ Installed `@crxjs/vite-plugin`
2. ✅ Simplified `vite.config.ts` (70 lines → 15 lines)
3. ✅ Updated `manifest.json` to point to source files
4. ✅ Removed `vite-plugin-static-copy`
5. ✅ Removed custom popup-mover plugin
6. ✅ Verified build succeeds
7. ✅ Updated documentation

## Verification

```bash
npm run build
# Check dist/ structure matches expected output above
```

## References

- [CRXJS Documentation](https://crxjs.dev/vite-plugin)
- [CRXJS GitHub](https://github.com/crxjs/chrome-extension-tools)
- [Vite Plugin Ecosystem](https://vitejs.dev/plugins/)

---

**Result**: Cleaner, faster, more maintainable build system ✅
