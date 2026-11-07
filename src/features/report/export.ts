import { browser } from 'wxt/browser';

import type { PanelState } from '@/features/page/controller';
import type { IssueDto, ScanResultDto, StressResultDto } from '@/messaging/protocol';

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

/** The results without the issues ignored on this site. */
function withoutIgnored<T extends ScanResultDto | StressResultDto>(
  results: T,
  ignored: ReadonlySet<string>,
): T {
  const keep = (issues: readonly IssueDto[]) => issues.filter((issue) => !ignored.has(issue.id));
  return 'issues' in results
    ? { ...results, issues: keep(results.issues) }
    : { ...results, atRisk: keep(results.atRisk), brokenNow: keep(results.brokenNow) };
}

/**
 * The results on screen as Markdown and JSON, with file names for saving
 * them. Issues ignored on this site are left out.
 */
export function exportResults(state: PanelState, ignored: ReadonlySet<string>, now = new Date()) {
  const context = reportContext(state);
  const shown = state.showing === 'stress' ? state.stress : state.scan;
  if (!context || !shown) return null;
  const results = withoutIgnored(shown, ignored);
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
  downloadBlob(name, new Blob([text], { type }));
}

/** "overflow-scout-shop.example-h2.title" (without an extension). */
export function screenshotName(url: string, label: string): string {
  const element = label.split(' > ').at(-1) ?? 'element';
  return `${exportFileName(url, new Date(), 'png').replace(/\.png$/, '')}-${element.replace(/[^\w.-]/g, '_')}`;
}

/** Saves a file through the browser's download flow. */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // Let the download start before the URL goes away.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
