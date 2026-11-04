import '@/ui/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';

import { App } from './App';

// Match the document language and direction to the browser UI (RTL-ready).
document.documentElement.lang = browser.i18n.getUILanguage();
document.documentElement.dir = browser.i18n.getMessage('@@bidi_dir') || 'ltr';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Overflow Scout: side panel root element #root is missing');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
