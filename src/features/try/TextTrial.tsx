import { i18n } from '#i18n';
import { CircleAlert, CircleCheck, RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import type { PresetKind } from '@/core';
import { PRESET_KINDS, getPreset, resizeParts, textLength, translatedLength } from '@/core';
import { formatPx, kindLabel } from '@/features/results/labels';
import type { TextTrialDto, TextValueDto } from '@/messaging/protocol';
import { Button } from '@/ui/Button';
import { Slider } from '@/ui/Slider';
import { cx } from '@/ui/cx';

export interface TextTrialProps {
  /** The element's own text, to start editing from. */
  initialText: string;
  /**
   * Puts a text in the element and measures it; null puts its own text back.
   * Keep its identity stable: a new function puts the text back.
   */
  onTry: (value: TextValueDto | null) => Promise<TextTrialDto | null>;
  /** Real-world examples (names, products, links…) under the field. */
  presets?: boolean;
  /** Moves focus to the field when it appears (it was opened from a button). */
  focusOnOpen?: boolean;
}

/** Waits this long after the last keystroke before the page updates. */
const TYPE_DELAY_MS = 120;
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

/**
 * The text at another length, grown or shortened the way the longer-text test
 * does it. The slider asks for an exact length; the buttons for whole words.
 */
const resized = (text: string, length: number, wholeWords = false) =>
  resizeParts([text], Math.max(1, length), 1, { wholeWords })[0] ?? text;

/** Fits, or what breaks and by how much: icon and words, never color alone. */
function Outcome({ trial }: { trial: TextTrialDto }) {
  const short = Math.max(trial.overflow.x, trial.overflow.y);
  return (
    <p className="flex min-w-0 items-start gap-1.5 tabular-nums">
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
 * Try your own text in an element, live: type or paste, drag to any length,
 * jump to a translation's length, or use real-world examples. The field holds
 * exactly what's on the page, so every way of changing it can be edited further.
 */
export function TextTrial({
  initialText,
  onTry,
  presets = false,
  focusOnOpen = false,
}: TextTrialProps) {
  const id = useId();
  const [text, setText] = useState(initialText);
  const [trial, setTrial] = useState<TextTrialDto | null>(null);
  const [preset, setPreset] = useState<{ kind: PresetKind; index: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusOnOpen) fieldRef.current?.focus();
  }, [focusOnOpen]);
  // While a request is out, only the newest value waits: fast typing never queues up.
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
        if (waiting() === undefined) setTrial(current === null ? null : result);
      }
      queueRef.current.busy = false;
    })();
  };

  /** Shows a text in the field and on the page; the element's own text puts it back. */
  const apply = (next: string, delay = 0) => {
    setText(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    const value = next === initialText || next.trim() === '' ? null : { text: next };
    if (delay === 0) send(value);
    else
      timerRef.current = setTimeout(() => {
        send(value);
      }, delay);
  };

  // Leaving (another result, closing) puts the element's own text back.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void onTry(null);
    },
    [onTry],
  );

  const original = textLength([initialText]);
  const length = textLength([text]);
  const max = Math.max(original * 4, original + 40, length);
  const lengths = [
    { label: i18n.t('try.translation'), length: translatedLength(original, 'realistic') },
    { label: i18n.t('try.worstCase'), length: translatedLength(original, 'worst') },
    { label: i18n.t('try.double'), length: original * 2 },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-small">
          <span className="text-fg-muted">{i18n.t('try.label')}</span>
          <span className="text-fg-muted tabular-nums">{chars(length)}</span>
        </label>
        <textarea
          id={id}
          value={text}
          rows={2}
          spellCheck={false}
          autoComplete="off"
          ref={fieldRef}
          onChange={(event) => {
            setPreset(null);
            apply(event.target.value, TYPE_DELAY_MS);
          }}
          className="field-sizing-content max-h-40 min-h-16 w-full resize-none rounded-control border border-line-strong bg-raised px-2.5 py-2 leading-snug transition-[border-color] duration-(--duration-press) ease-(--ease-out) focus:border-accent"
        />
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={i18n.t('try.lengths')}>
        {lengths.map((option) => (
          <Button
            key={option.label}
            size="sm"
            onClick={() => {
              setPreset(null);
              apply(resized(initialText, option.length, true));
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <Slider
        label={i18n.t('inspect.length')}
        valueText={chars(length)}
        value={Math.min(length, max)}
        min={1}
        max={max}
        onChange={(next) => {
          setPreset(null);
          apply(resized(initialText, next));
        }}
      />

      {presets && (
        <div className="flex flex-col gap-1.5">
          <span className="text-small text-fg-muted">{i18n.t('inspect.presets')}</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_KINDS.map((kind) => {
              const active = preset?.kind === kind;
              return (
                <Button
                  key={kind}
                  size="sm"
                  // A variant, not extra classes: two backgrounds would fight over CSS order.
                  variant={active ? 'ghost' : 'secondary'}
                  aria-pressed={active}
                  className={cx(active && 'bg-accent-soft shadow-[0_0_0_1px_var(--color-accent)]')}
                  onClick={() => {
                    // Each press moves to the next example of its kind.
                    const index = active ? preset.index + 1 : 0;
                    setPreset({ kind, index });
                    apply(getPreset(kind, index));
                  }}
                >
                  {presetLabel(kind)}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2" aria-live="polite">
        {trial && <Outcome trial={trial} />}
        {text !== initialText && (
          <Button
            size="sm"
            variant="ghost"
            className="text-fg-muted hover:text-fg"
            icon={<RotateCcw {...ICON} />}
            onClick={() => {
              setPreset(null);
              apply(initialText);
            }}
          >
            {i18n.t('inspect.reset')}
          </Button>
        )}
      </div>
    </div>
  );
}
