import { i18n } from '#i18n';
import { Crosshair, X } from 'lucide-react';

import type { PickedElement } from '@/messaging/protocol';
import type { Tone } from '@/ui/Chip';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { MeasureBar } from '@/ui/MeasureBar';

import type { TryTextProps } from './TryText';
import { TryText } from './TryText';

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
  /** Stops picking without measuring anything (also Esc). */
  onCancelPick: () => void;
  /** Must keep its identity: a new function would put the tried text back. */
  onTryText: TryTextProps['onTry'];
  /** The picked element's whole text, to start editing from. Keep its identity stable. */
  onTextOf: TryTextProps['loadText'];
}

/** A key per pick, so trying text starts over for each element. */
const pickKeys = new WeakMap<PickedElement, number>();
let nextPickKey = 0;
function keyOf(picked: PickedElement): number {
  let key = pickKeys.get(picked);
  if (key === undefined) {
    nextPickKey += 1;
    key = nextPickKey;
    pickKeys.set(picked, key);
  }
  return key;
}

export function InspectCard({
  picking,
  picked,
  onClose,
  onCancelPick,
  onTryText,
  onTextOf,
}: InspectCardProps) {
  if (picking) {
    // The panel waits for a click on the page: say so where the eye already is, with a way out.
    return (
      <div className="flex animate-enter items-center gap-2 rounded-card bg-accent-soft p-3 shadow-[0_0_0_1px_var(--color-accent)]">
        <Crosshair
          size={16}
          strokeWidth={1.5}
          aria-hidden="true"
          className="shrink-0 text-accent"
        />
        <p className="min-w-0 flex-1" role="status">
          {i18n.t('inspect.hint')}
        </p>
        <Button size="sm" aria-keyshortcuts="Escape" onClick={onCancelPick}>
          {i18n.t('actions.cancel')}
        </Button>
      </div>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge tone={VERDICT[point.verdict].tone}>{VERDICT[point.verdict].label()}</Badge>
            <span className="text-small text-fg-muted tabular-nums">
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
          <TryText
            key={keyOf(picked)}
            onTry={onTryText}
            loadText={onTextOf}
            fallback={picked.text}
          />
        </>
      ) : (
        <p className="text-fg-muted">{i18n.t('inspect.noText')}</p>
      )}
    </section>
  );
}
