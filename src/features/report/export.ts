import { browser } from 'wxt/browser';

import type { PanelState } from '@/features/page/controller';

import { browserName, exportFileName, resultsJson } from './json';
import type { ReportContext } from './markdown';
import { resultsMarkdown } from './markdown';

/** The context of the results on screen, or null when there are none. */
export function reportContext(state: PanelState): ReportContext | null {
  const results = state.showing === 'stress' ? state.stress : state.scan;
  if (!results) return null;
  return {
    url: state.page?.url ?? '',
    viewport: results.viewport,
    browser: browserName(navigator.userAgent),
    stress:
      state.showing === 'stress' && state.stress && state.stressOptions
        ? { options: state.stressOptions, growth: state.stress.stats.stress.growth }
        : null,
  };
}

/** The results on screen as Markdown and JSON, with file names for saving them. */
export function exportResults(state: PanelState, now = new Date()) {
  const context = reportContext(state);
  const results = state.showing === 'stress' ? state.stress : state.scan;
  if (!context || !results) return null;
  return {
    markdown: resultsMarkdown(results, context),
    markdownName: exportFileName(context.url, now, 'md'),
    json: resultsJson({
      version: browser.runtime.getManifest().version,
      createdAt: now,
      title: state.page?.title ?? '',
      context,
      results,
    }),
    jsonName: exportFileName(context.url, now, 'json'),
  };
}

/** Saves text as a file through the browser's download flow (no extra permission). */
export function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // Let the download start before the URL goes away.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
