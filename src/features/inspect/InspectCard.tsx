import { i18n } from '#i18n';

import type { PickedElement } from '@/messaging/protocol';

type Verdict = NonNullable<PickedElement['breakingPoint']>['verdict'];

const VERDICT: Readonly<Record<Verdict, { label: () => string; className: string }>> = {
  fits: { label: () => i18n.t('inspect.verdict.fits'), className: 'bg-notice-soft text-notice' },
  'at-risk': {
    label: () => i18n.t('inspect.verdict.atRisk'),
    className: 'bg-warning-soft text-warning',
  },
  'will-break': {
    label: () => i18n.t('inspect.verdict.willBreak'),
    className: 'bg-critical-soft text-critical',
  },
  broken: {
    label: () => i18n.t('inspect.verdict.broken'),
    className: 'bg-critical-soft text-critical',
  },
};

interface InspectCardProps {
  picking: boolean;
  picked: PickedElement | null;
}

export function InspectCard({ picking, picked }: InspectCardProps) {
  if (picking) {
    return (
      <p className="rounded-card border border-line p-3 text-fg-muted" role="status">
        {i18n.t('inspect.hint')}
      </p>
    );
  }
  if (!picked) return null;
  const point = picked.breakingPoint;
  return (
    <section
      className="flex flex-col gap-2 rounded-card border border-line p-3"
      aria-label={i18n.t('inspect.heading')}
    >
      <p className="truncate font-mono text-small text-fg-muted">{picked.element.label}</p>
      <p className="line-clamp-2 break-words">{picked.text}</p>
      {point ? (
        <>
          <span
            className={`self-start rounded-control px-1.5 text-small font-semibold ${VERDICT[point.verdict].className}`}
          >
            {VERDICT[point.verdict].label()}
          </span>
          <p className="tabular-nums">
            {point.fitsUpTo === null
              ? i18n.t('inspect.fitsAll', [String(point.maxTested)])
              : i18n.t('inspect.fitsUpTo', [String(point.fitsUpTo)])}
          </p>
          <p className="text-small text-fg-muted tabular-nums">
            {i18n.t('inspect.needs', [
              String(point.length),
              String(point.needs.realistic),
              String(point.needs.worst),
            ])}
          </p>
        </>
      ) : (
        <p className="text-fg-muted">{i18n.t('inspect.noText')}</p>
      )}
    </section>
  );
}
