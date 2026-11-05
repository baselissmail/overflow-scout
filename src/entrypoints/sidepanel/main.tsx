import '@/ui/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { i18n } from '#i18n';
import { browser } from 'wxt/browser';

import { ToastProvider } from '@/ui/Toast';
import { TooltipProvider } from '@/ui/Tooltip';

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
    <TooltipProvider>
      <ToastProvider label={i18n.t('toast.label')}>
        <App />
      </ToastProvider>
    </TooltipProvider>
  </StrictMode>,
);

// e2e builds only: the side panel must pass its own stress test (plan §5.1,
// "dogfood"), so tests need the engine on this page. Production builds drop this.
if (import.meta.env.MODE === 'e2e') {
  void import('@/core').then((core) => {
    Object.assign(window, { overflowScout: core });
  });
}
