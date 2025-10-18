# Overflow Scout

> Stress-test text overflow on live web applications without opening DevTools

A Chrome extension for UI engineers and QA testers that finds overflow failures instantly and systematically before they reach production.

## 🚀 Current Status: Phase 5 Complete

**State & Revert All** ✅
- Central state manager for all modifications
- One-click "Revert All" restoration
- Session banner indicating test mode
- Real-time stats (tested vs broken)
- Safe, instantaneous full restoration
- Session tracking with timestamps
- Automatic cleanup on completion

## 📋 Development Phases

- ✅ **Phase 0** - Foundation & Scaffolding
- ✅ **Phase 1** - Single Element Injection
- ✅ **Phase 2** - Smart Text Generation
- ✅ **Phase 3** - Overflow Detection & Highlighting
- ✅ **Phase 4** - Batch Testing "Test All Similar"
- ✅ **Phase 5** - State & Revert All
- 🔜 **Phase 6** - Advanced Support (Shadow DOM, SPAs)
- 🔜 **Phase 7** - Popup UI & Controls
- 🔜 **Phase 8** - Polish, Edge Cases, Stability
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

- **Right-click testing**: One-click text overflow injection
- **Smart text generation**: Context-aware long strings (i18n, RTL, UGC)
- **Automatic detection**: Find clipping, ellipsis, line-clamp issues
- **Batch testing**: Test all similar components at once
- **Visual highlighting**: Non-intrusive overlay system
- **Instant revert**: One-click restoration to original state
- **SPA support**: Works with React, Vue, modern frameworks
- **Shadow DOM**: Handles Web Components where possible

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue first to discuss changes.

---

**Built with ❤️ for UI/QA engineers**
