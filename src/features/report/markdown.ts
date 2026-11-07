import { i18n } from '#i18n';

import { fixCss, fixesFor } from '@/core';
import { adviceText, verdictText } from '@/features/results/fix-text';
import { formatCount, kindDescription, kindLabel, severityLabel } from '@/features/results/labels';
import { measurement, measurementSentence } from '@/features/results/measure';
import { lengthLabel } from '@/features/check/length';
import type {
  FindingDto,
  FixTrialsDto,
  IssueDto,
  StressOptionsDto,
  TextCutDto,
} from '@/messaging/protocol';

/** Where and how the results were taken; the first lines of every report. */
export interface ReportContext {
  url: string;
  viewport: { width: number; height: number };
  /** e.g. "Chrome 156". */
  browser: string | null;
  /** The longer-text test the results come from, or null for a plain scan. */
  stress: { options: StressOptionsDto; growth: number } | null;
}

/** One place of an issue, with what's known about it so far. */
export interface ReportPlace {
  finding: FindingDto;
  cut: TextCutDto | null;
  selector: string | null;
  /** Fix trials, when they ran; otherwise the fixes are listed as suggestions. */
  fixes: FixTrialsDto | null;
}

/**
 * The panel keeps numbers and units together with no-break spaces; a pasted
 * report is plain text, so they become ordinary spaces.
 */
const plain = (text: string) => text.replace(/\u00a0/g, ' ');

/** Text that Markdown would otherwise format (emphasis, links, HTML, tables). */
export function escapeText(text: string): string {
  return text.replace(/[\\`*_[\]<>|~]/g, '\\$&');
}

/** An inline code span that survives backticks and line breaks in its content. */
export function code(text: string): string {
  const flat = text.replace(/\s*\n\s*/g, ' ');
  const longest = Math.max(0, ...[...flat.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = '`'.repeat(longest + 1);
  const pad = flat.startsWith('`') || flat.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${flat}${pad}${fence}`;
}

const quote = (text: string) => `"${escapeText(text)}"`;

function testLine(stress: NonNullable<ReportContext['stress']>): string {
  const { options, growth } = stress;
  return i18n.t('report.test', [lengthLabel(options.intensity), String(growth)]);
}

/** "Page: https://..., window 800x900, Chrome 156", and the test it ran with. */
export function contextLines(context: ReportContext): string[] {
  const window = `${String(context.viewport.width)}x${String(context.viewport.height)}`;
  const where = [context.url, i18n.t('report.window', [window]), context.browser].filter(Boolean);
  return [
    `- **${i18n.t('report.page')}:** ${where.join(', ')}`,
    ...(context.stress ? [`- **${i18n.t('report.testLabel')}:** ${testLine(context.stress)}`] : []),
  ];
}

function textLines(finding: FindingDto, cut: TextCutDto | null): string[] {
  const lines: string[] = [];
  if (finding.before) {
    lines.push(`- **${i18n.t('detail.before')}:** ${quote(finding.before)}`);
    lines.push(`- **${i18n.t('report.longer')}:** ${quote(finding.text)}`);
  } else if (finding.text !== '') {
    lines.push(`- **${i18n.t('detail.text')}:** ${quote(finding.text)}`);
  }
  if (cut) {
    lines.push(
      `- **${i18n.t('report.cut')}:** ` +
        i18n.t(finding.kind === 'spilling' ? 'report.cutSpills' : 'report.cutLost', [
          quote(cut.visible.trimEnd()),
          quote(cut.hidden.trimStart()),
        ]),
    );
  }
  return lines;
}

function causeLines(finding: FindingDto): string[] {
  const { confidence, causes } = finding.diagnosis;
  if (causes.length === 0) return [`- **${i18n.t('detail.cause')}:** ${i18n.t('detail.noCause')}`];
  const level =
    confidence === 'high' ? i18n.t('detail.confidenceHigh') : i18n.t('detail.confidenceMedium');
  return [
    `- **${i18n.t('detail.cause')}** (${level.toLowerCase()}):`,
    ...causes.map(
      (cause) =>
        `  - ${code(`${cause.property}: ${cause.value}`)} ${i18n.t('report.on')} ${code(cause.element.label)}: ${escapeText(cause.note)}`,
    ),
  ];
}

function fixLines(finding: FindingDto, fixes: FixTrialsDto | null): string[] {
  const items = [
    ...fixesFor(finding).map((fix) => ({
      key: fix.key,
      css: fixCss(fix),
      element: fix.element.label,
    })),
    ...(fixes?.added ?? []).map((fix) => ({
      key: fix.key,
      css: fix.css,
      element: fix.element.label,
    })),
  ];
  if (items.length === 0) return [];
  const heading = fixes ? i18n.t('report.fixesTried') : i18n.t('report.fixesSuggested');
  const lines = items.map((item) => {
    const where = `${i18n.t('report.on')} ${code(item.element)}`;
    const trial = fixes?.trials.find((entry) => entry.key === item.key)?.trial;
    const what = item.css
      ? `${code(item.css)} ${where}`
      : `${escapeText(adviceText(item.key))} (${where})`;
    return `  - ${what}${trial ? `: ${verdictText(trial)}` : ''}`;
  });
  if (fixes?.combined) lines.push(`  - ${verdictText(fixes.combined, true)}`);
  return [`- **${heading}:**`, ...lines];
}

/**
 * One issue as Markdown, for pasting into GitHub or Jira (plan §5, Phase 5):
 * what goes wrong, where, by how much, why, and what fixes it.
 */
export function issueMarkdown(
  issue: IssueDto,
  place: ReportPlace,
  context: ReportContext,
  options: { heading?: string; withContext?: boolean } = {},
): string {
  const { finding, cut, selector, fixes } = place;
  const places = issue.instances.length;
  const title =
    `${options.heading ?? '###'} ${kindLabel(issue.kind)}: ${code(finding.element.label)}` +
    (places > 1 ? ` (${i18n.t('results.places', places, [formatCount(places)])})` : '');
  const lines = [
    title,
    '',
    ...(options.withContext === false ? [] : contextLines(context)),
    `- **${i18n.t('report.severity')}:** ${severityLabel(issue.severity)}. ${kindDescription(issue.kind)}`,
    ...textLines(finding, cut),
    `- **${i18n.t('report.size')}:** ${measurementSentence(measurement(finding, context.viewport))}`,
    ...(selector ? [`- **${i18n.t('detail.selector')}:** ${code(selector)}`] : []),
    ...causeLines(finding),
    ...fixLines(finding, fixes),
  ];
  return plain(`${lines.join('\n')}\n`);
}

/** The first place of an issue: the one that arrives with its selector and cut. */
function firstPlace(issue: IssueDto): ReportPlace | null {
  const finding = issue.instances[0];
  if (!finding) return null;
  return {
    finding,
    cut: finding.cut ?? null,
    selector: finding.element.selector ?? null,
    fixes: null,
  };
}

function issueSections(
  issues: readonly IssueDto[],
  context: ReportContext,
  heading: string,
): string[] {
  return issues.flatMap((issue) => {
    const place = firstPlace(issue);
    return place ? [issueMarkdown(issue, place, context, { heading, withContext: false })] : [];
  });
}

function section(
  title: string,
  issues: readonly IssueDto[],
  none: string,
  context: ReportContext,
): string[] {
  return [
    `### ${title} (${formatCount(issues.length)})`,
    '',
    ...(issues.length === 0 ? [`${none}\n`] : []),
    ...issueSections(issues, context, '####'),
  ];
}

/** Every result as one Markdown report: the context once, then each issue. */
export function resultsMarkdown(
  results:
    | { issues: readonly IssueDto[] }
    | { atRisk: readonly IssueDto[]; brokenNow: readonly IssueDto[] },
  context: ReportContext,
): string {
  const body =
    'issues' in results
      ? issueSections(results.issues, context, '###')
      : [
          ...section(
            i18n.t('results.atRisk'),
            results.atRisk,
            i18n.t('results.noneAtRisk'),
            context,
          ),
          ...section(
            i18n.t('results.brokenNow'),
            results.brokenNow,
            i18n.t('results.noneNow'),
            context,
          ),
        ];
  const count =
    'issues' in results ? results.issues.length : results.atRisk.length + results.brokenNow.length;
  return plain(
    [
      `## ${i18n.t('report.title')}`,
      '',
      ...contextLines(context),
      `- **${i18n.t('report.found')}:** ${i18n.t('report.issues', count, [formatCount(count)])}`,
      '',
      ...body,
    ].join('\n'),
  );
}
