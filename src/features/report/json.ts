import type { ReportContext } from './markdown';
import type { ScanResultDto, StressResultDto } from '@/messaging/protocol';

/** The results as data, for scripts and bug trackers: `overflow-scout/results`, version 1. */
export function resultsJson(input: {
  version: string;
  createdAt: Date;
  title: string;
  context: ReportContext;
  results: ScanResultDto | StressResultDto;
}): string {
  const { context, results } = input;
  const test = context.stress && { ...context.stress.options, growth: context.stress.growth };
  return JSON.stringify(
    {
      format: 'overflow-scout/results',
      formatVersion: 1,
      tool: { name: 'Overflow Scout', version: input.version },
      createdAt: input.createdAt.toISOString(),
      page: { url: context.url, title: input.title },
      viewport: context.viewport,
      browser: context.browser,
      test,
      ...('issues' in results
        ? { issues: results.issues, stats: results.stats }
        : { atRisk: results.atRisk, brokenNow: results.brokenNow, stats: results.stats }),
    },
    null,
    2,
  );
}

/** "overflow-scout-shop.example-2026-11-05-2215.json" */
export function exportFileName(url: string, at: Date, extension: string): string {
  let host = 'page';
  try {
    host = new URL(url).hostname || host;
  } catch {
    // Keep the generic name for URLs without a host.
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`;
  return `overflow-scout-${host.replace(/[^\w.-]/g, '_')}-${stamp}.${extension}`;
}

/** e.g. "Chrome 156", from the panel's own user agent. */
export function browserName(userAgent: string): string | null {
  // Edge and Opera also name Chrome, so they're checked first.
  for (const [token, name] of [
    ['Edg', 'Edge'],
    ['OPR', 'Opera'],
    ['Chrome', 'Chrome'],
  ] as const) {
    const match = new RegExp(`${token}/(\\d+)`).exec(userAgent);
    if (match?.[1]) return `${name} ${match[1]}`;
  }
  return null;
}
