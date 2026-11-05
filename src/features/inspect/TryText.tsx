import { i18n } from '#i18n';
import { CircleAlert, CircleCheck, RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import type { PresetKind } from '@/core';
import { PRESET_KINDS, getPreset } from '@/core';
import { formatPx, kindLabel } from '@/features/results/labels';
import type { PickedElement, TextTrialDto, TextValueDto } from '@/messaging/protocol';
import { Button } from '@/ui/Button';
import { Slider } from '@/ui/Slider';

type BreakingPoint = NonNullable<PickedElement['breakingPoint']>;

export interface TryTextProps {
  point: BreakingPoint;
  /** Puts a text in the element and measures it; null puts its own text back. */
  onTry: (value: TextValueDto | null) => Promise<TextTrialDto | null>;
}

const ICON = { size: 14, strokeWidth: 1.5 } as const;

function presetLabel(kind: PresetKind): string {
  switch (kind) {
    case 'longName':
      return i18n.t('inspect.preset.longName');
    case 'product':
      return i18n.t('inspect.preset.product');
    case 'url':
      return i18n.t('inspect.preset.url');
    case 'email':
      return i18n.t('inspect.preset.email');
    case 'longText':
      return i18n.t('inspect.preset.longText');
  }
}

const chars = (length: number) => i18n.t('inspect.chars', length, [String(length)]);

/** Fits, or what breaks and by how much: icon and words, never color alone. */
function Outcome({ trial }: { trial: TextTrialDto }) {
  const short = Math.max(trial.overflow.x, trial.overflow.y);
  return (
    <p className="flex items-start gap-1.5 tabular-nums">
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {trial.fits ? (
          <CircleCheck {...ICON} className="text-ok" />
        ) : (
          <CircleAlert {...ICON} className="text-critical" />
        )}
      </span>
      <span>
        {trial.fits || trial.breaksAs === null
          ? i18n.t('inspect.tryFits', [chars(trial.length)])
          : i18n.t('inspect.tryBreaks', [
              kindLabel(trial.breaksAs),
              chars(trial.length),
              formatPx(short),
            ])}
      </span>
    </p>
  );
}

/**
 * Try other text in the picked element (plan §5.3): drag to any length, or
 * use real-world text (names, products, links, emails) or your own. The page
 * shows the text live; it goes back when the card closes.
 */
export function TryText({ point, onTry }: TryTextProps) {
  const [length, setLength] = useState(point.length);
  const [trial, setTrial] = useState<TextTrialDto | null>(null);
  const [active, setActive] = useState<PresetKind | 'custom' | null>(null);
  const [custom, setCustom] = useState('');
  const presetIndexRef = useRef<Partial<Record<PresetKind, number>>>({});
  const customId = useId();
  // While a request is out, only the newest value waits: a fast drag never queues up.
  const queueRef = useRef<{ busy: boolean; next: TextValueDto | null | undefined }>({
    busy: false,
    next: undefined,
  });

  const waiting = () => queueRef.current.next;

  const send = (value: TextValueDto | null) => {
    queueRef.current.next = value;
    if (queueRef.current.busy) return;
    queueRef.current.busy = true;
    void (async () => {
      while (queueRef.current.next !== undefined) {
        const current = queueRef.current.next;
        queueRef.current.next = undefined;
        const result = await onTry(current);
        // Read after the await: a newer value may have arrived meanwhile.
        if (waiting() === undefined) {
          setTrial(current === null ? null : result);
          if (result) setLength(result.length);
        }
      }
      queueRef.current.busy = false;
    })();
  };

  // Leaving (another pick, closing the card) puts the element's own text back.
  useEffect(
    () => () => {
      void onTry(null);
    },
    [onTry],
  );

  const reset = () => {
    setActive(null);
    setLength(point.length);
    send(null);
  };

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="font-medium">{i18n.t('inspect.tryHeading')}</h3>
        <p className="text-small text-fg-muted">{i18n.t('inspect.tryHint')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-small">
          <span className="text-fg-muted">{i18n.t('inspect.length')}</span>
          <span className="tabular-nums">{chars(length)}</span>
        </div>
        <Slider
          label={i18n.t('inspect.length')}
          valueText={chars(length)}
          value={length}
          min={1}
          max={point.maxTested}
          onChange={(next) => {
            setLength(next);
            setActive(null);
            send({ length: next });
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-small text-fg-muted">{i18n.t('inspect.presets')}</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_KINDS.map((kind) => (
            <Button
              key={kind}
              size="sm"
              aria-pressed={active === kind}
              className="aria-pressed:border-accent aria-pressed:bg-accent-soft"
              onClick={() => {
                // Each press moves to the next example of its kind.
                const index = active === kind ? (presetIndexRef.current[kind] ?? 0) + 1 : 0;
                presetIndexRef.current[kind] = index;
                setActive(kind);
                send({ text: getPreset(kind, index) });
              }}
            >
              {presetLabel(kind)}
            </Button>
          ))}
        </div>
      </div>

      <form
        className="flex flex-col gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (custom.trim() === '') return;
          setActive('custom');
          send({ text: custom });
        }}
      >
        <label htmlFor={customId} className="text-small text-fg-muted">
          {i18n.t('inspect.custom')}
        </label>
        <div className="flex gap-2">
          <input
            id={customId}
            value={custom}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setCustom(event.target.value);
            }}
            className="min-h-8 min-w-0 flex-1 rounded-control border border-line-strong bg-raised px-2"
          />
          <Button size="sm" type="submit" className="min-h-8">
            {i18n.t('inspect.try')}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2" aria-live="polite">
        {trial && <Outcome trial={trial} />}
        {trial && (
          <Button size="sm" variant="ghost" icon={<RotateCcw {...ICON} />} onClick={reset}>
            {i18n.t('inspect.reset')}
          </Button>
        )}
      </div>
    </section>
  );
}
