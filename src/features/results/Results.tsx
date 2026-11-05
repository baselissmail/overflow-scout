import { i18n } from '#i18n';
import { useState } from 'react';

import type { IssueDto, ScanResultDto, StressResultDto } from '@/messaging/protocol';

import { SEVERITY_CLASSES, formatCount, kindLabel } from './labels';

interface ResultsProps {
  scan: ScanResultDto | null;
  stress: StressResultDto | null;
  showing: 'scan' | 'stress' | null;
  onHighlight: (findingId: string | null) => void;
  onReveal: (findingId: string) => void;
}

type Tab = 'brokenNow' | 'atRisk';

function IssueRow({
  issue,
  onHighlight,
  onReveal,
}: {
  issue: IssueDto;
  onHighlight: ResultsProps['onHighlight'];
  onReveal: ResultsProps['onReveal'];
}) {
  const [first] = issue.instances;
  if (!first) return null;
  const places = issue.instances.length;
  return (
    <li>
      <button
        type="button"
        className="flex w-full flex-col items-start gap-1 rounded-control px-2 py-2 text-start hover:bg-surface focus-visible:bg-surface"
        onMouseEnter={() => {
          onHighlight(first.id);
        }}
        onMouseLeave={() => {
          onHighlight(null);
        }}
        onFocus={() => {
          onHighlight(first.id);
        }}
        onBlur={() => {
          onHighlight(null);
        }}
        onClick={() => {
          onReveal(first.id);
        }}
      >
        <span className="flex w-full items-center gap-2">
          <span
            className={`shrink-0 rounded-control px-1.5 text-small font-semibold ${SEVERITY_CLASSES[issue.severity]}`}
          >
            {kindLabel(issue.kind)}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-small text-fg-muted">
            {first.element.label}
          </span>
          {places > 1 && (
            <span className="shrink-0 text-small text-fg-muted tabular-nums">
              {i18n.t('results.places', places, [formatCount(places)])}
            </span>
          )}
        </span>
        <span className="line-clamp-2 break-words">{first.text}</span>
      </button>
    </li>
  );
}

function IssueList({
  issues,
  ...handlers
}: { issues: readonly IssueDto[] } & Omit<ResultsProps, 'scan' | 'stress' | 'showing'>) {
  return (
    <ul className="flex flex-col" aria-label={i18n.t('results.heading')}>
      {issues.map((issue) => (
        <IssueRow key={issue.id} issue={issue} {...handlers} />
      ))}
    </ul>
  );
}

export function Results({ scan, stress, showing, onHighlight, onReveal }: ResultsProps) {
  const [tab, setTab] = useState<Tab>('atRisk');
  const handlers = { onHighlight, onReveal };

  if (showing === 'stress' && stress) {
    const issues = tab === 'atRisk' ? stress.atRisk : stress.brokenNow;
    const tabs: [Tab, string, number][] = [
      ['atRisk', i18n.t('results.atRisk'), stress.atRisk.length],
      ['brokenNow', i18n.t('results.brokenNow'), stress.brokenNow.length],
    ];
    return (
      <section className="flex flex-col gap-2" aria-label={i18n.t('results.heading')}>
        <div className="flex gap-1 rounded-control bg-surface p-0.5">
          {tabs.map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              className="flex-1 rounded-control px-2 py-1 text-small font-medium text-fg-muted aria-pressed:bg-canvas aria-pressed:text-fg aria-pressed:shadow-sm"
              onClick={() => {
                setTab(value);
              }}
            >
              {label} <span className="tabular-nums">{formatCount(count)}</span>
            </button>
          ))}
        </div>
        {issues.length > 0 ? (
          <IssueList issues={issues} {...handlers} />
        ) : (
          <p className="px-2 text-fg-muted">
            {tab === 'atRisk' ? i18n.t('results.noneAtRisk') : i18n.t('results.noneNow')}
          </p>
        )}
        <p className="px-2 text-small text-fg-muted tabular-nums">
          {i18n.t('results.footerStress', [
            formatCount(stress.stats.stressed.textNodes),
            formatCount(Math.round(stress.stats.durationMs)),
          ])}
        </p>
      </section>
    );
  }

  if (showing === 'scan' && scan) {
    const viewport = `${String(scan.viewport.width)}×${String(scan.viewport.height)}`;
    return (
      <section className="flex flex-col gap-2" aria-label={i18n.t('results.heading')}>
        {scan.issues.length > 0 ? (
          <IssueList issues={scan.issues} {...handlers} />
        ) : (
          <p className="px-2 text-fg-muted">
            {i18n.t('results.none', [formatCount(scan.stats.textNodes), viewport])}
          </p>
        )}
        <p className="px-2 text-small text-fg-muted tabular-nums">
          {i18n.t('results.footer', [
            formatCount(scan.stats.textNodes),
            formatCount(Math.round(scan.stats.durationMs)),
            viewport,
          ])}
        </p>
      </section>
    );
  }

  return null;
}
