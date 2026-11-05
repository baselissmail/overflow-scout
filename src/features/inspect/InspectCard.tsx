import { i18n } from '#i18n';
import { X } from 'lucide-react';

import type { PickedElement } from '@/messaging/protocol';
import type { Tone } from '@/ui/Chip';
import { Badge } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { MeasureBar } from '@/ui/MeasureBar';

type Verdict = NonNullable<PickedElement['breakingPoint']>['verdict'];

const VERDICT: Readonly<Record<Verdict, { label: () => string; tone: Tone }>> = {
  fits: { label: () => i18n.t('inspect.verdict.fits'), tone: 'ok' },
  'at-risk': { label: () => i18n.t('inspect.verdict.atRisk'), tone: 'warning' },
  'will-break': { label: () => i18n.t('inspect.verdict.willBreak'), tone: 'critical' },
  broken: { label: () => i18n.t('inspect.verdict.broken'), tone: 'critical' },
};

interface InspectCardProps {
  picking: boolean;
  picked: PickedElement | null;
  onClose: () => void;
}

export function InspectCard({ picking, picked, onClose }: InspectCardProps) {
  if (picking) {
    return (
      <p
        className="animate-enter rounded-card border border-accent bg-accent-soft p-3"
        role="status"
      >
        {i18n.t('inspect.hint')}
      </p>
    );
  }
  if (!picked) return null;
  const point = picked.breakingPoint;
  return (
    <section
      className="flex animate-enter flex-col gap-3 rounded-card bg-raised p-3 shadow-raised"
      aria-label={i18n.t('inspect.heading')}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 font-mono text-small break-all text-fg-muted" translate="no">
            {picked.element.selector ?? picked.element.label}
          </p>
          <IconButton
            label={i18n.t('inspect.close')}
            icon={<X size={16} strokeWidth={1.5} />}
            onClick={onClose}
          />
        </div>
        <p className="line-clamp-2 break-words" title={picked.text}>
          {picked.text}
        </p>
      </div>
      {point ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={VERDICT[point.verdict].tone}>{VERDICT[point.verdict].label()}</Badge>
            <span className="tabular-nums">
              {point.fitsUpTo === null
                ? i18n.t('inspect.fitsAll', [String(point.maxTested)])
                : i18n.t('inspect.fitsUpTo', [String(point.fitsUpTo)])}
            </span>
          </div>
          <MeasureBar
            has={point.fitsUpTo ?? point.maxTested}
            needs={point.needs.worst}
            tone={VERDICT[point.verdict].tone}
            hasLabel={i18n.t('inspect.has', [String(point.fitsUpTo ?? point.maxTested)])}
            needsLabel={i18n.t('inspect.needsChars', [String(point.needs.worst)])}
            differenceLabel={
              (point.fitsUpTo ?? point.maxTested) >= point.needs.worst
                ? `+${String((point.fitsUpTo ?? point.maxTested) - point.needs.worst)}`
                : `−${String(point.needs.worst - (point.fitsUpTo ?? 0))}`
            }
            description={i18n.t('inspect.measure', [
              String(point.fitsUpTo ?? point.maxTested),
              String(point.needs.worst),
            ])}
          />
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
