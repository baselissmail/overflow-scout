# Overflow Scout

> Stress-test text overflow on live web applications without opening DevTools

A Chrome extension for UI engineers and QA testers that finds overflow failures instantly and systematically before they reach production.

## 🚀 Current Status: Phase 9 Started

**Professional UX Modules (Ready for Integration)** ✅
- Ghost Overlay mode (CSS-based, non-destructive testing)
- Clone measurement (detect without DOM modification)
- Smart text generation (varied, length-banded, role-appropriate)
- Badge indicators (small corner badges vs. full borders)
- Viewport filtering & sampling utilities
- Enhanced type system (InjectionMode, BatchMode)

See [PHASE9_IMPLEMENTATION.md](./PHASE9_IMPLEMENTATION.md) for details.

## 📋 Development Phases

- ✅ **Phase 0** - Foundation & Scaffolding
- ✅ **Phase 1** - Single Element Injection
- ✅ **Phase 2** - Smart Text Generation
- ✅ **Phase 3** - Overflow Detection & Highlighting
- ✅ **Phase 4** - Batch Testing "Test All Similar"
- ✅ **Phase 5** - State & Revert All
- ✅ **Phase 6** - Advanced Support (Shadow DOM, SPAs)
- ✅ **Phase 7** - Popup UI & Controls
- ✅ **Phase 8** - Polish, Edge Cases, Stability
- 🔜 **Phase 9** - Packaging & Marketing
- 🔜 **Phase 10** - Launch & Feedback

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Chrome browser

### Tech Stack
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast builds
- **CRXJS** - Chrome extension Vite plugin with HMR
- **Manifest v3** - Latest extension platform

### Setup
```bash
# Install dependencies
npm install

# Development build (watch mode with HMR)
npm run dev

# Production build
npm run build

# Type checking
npm run type-check
```

### Loading the Extension

1. Run `npm run build` to create the `dist/` folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `dist/` folder
6. The extension icon should appear in your toolbar

## 🏗️ Architecture

```
src/
├── background/          # Service worker (context menus, messaging)
├── content/             # DOM manipulation, injection, detection
├── popup/               # Extension UI (HTML, CSS, TS)
└── types/               # Shared TypeScript types and utilities

public/
└── icons/               # Extension icons (16, 48, 128px)
```

### Key Design Patterns

- **Message-based architecture**: Background ↔ Content ↔ Popup communication
- **Type-safe messaging**: Strongly-typed message enums and payloads
- **Dependency injection ready**: Modular services for testing
- **Phase-based implementation**: Clear separation of concerns for incremental development

## 🎯 Core Features (Planned)

## Usage

### Quick Start

1. **Click the extension icon** to open the popup
2. **Click "🤖 Auto-Scan Page"** to find all overflow issues instantly
3. **View results** in the detailed side panel
4. **Test individual elements** with custom text
5. **Jump to elements** to see exactly where issues are
6. **Apply suggested fixes** to your CSS

### Features

- **🤖 Auto-Scan**: Automatically detect all overflow issues on the page
- **👆 Point & Click Mode**: Click any element to test it interactively
- **🧪 Custom Text Testing**: Test each element with real data from your app
- **💡 Actionable Fixes**: Get specific CSS suggestions for each issue
- **🎯 Jump to Element**: Visual highlighting shows exactly which element
- **↩️ Revert All**: Restore page to original state
- **SPA support**: Works with React, Vue, modern frameworks
- **Shadow DOM**: Handles Web Components where possible

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue first to discuss changes.

---

**Built with ❤️ for UI/QA engineers**
