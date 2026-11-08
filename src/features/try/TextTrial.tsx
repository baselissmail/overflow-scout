import { i18n } from '#i18n';
import { CircleAlert, CircleCheck, RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import type { PresetKind } from '@/core';
import { getPreset, resizeParts, textLength, translatedLength } from '@/core';
import { formatPx, kindLabel } from '@/features/results/labels';
import type { TextTrialDto, TextValueDto } from '@/messaging/protocol';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';

export interface TextTrialProps {
  /** The element's own text, to start editing from. */
  initialText: string;
  /**
   * Puts a text in the element and measures it; null puts its own text back.
   * Keep its identity stable: a new function puts the text back.
   */
  onTry: (value: TextValueDto | null) => Promise<TextTrialDto | null>;
  /** Moves focus to the field when it appears (it was opened on purpose). */
  focusOnOpen?: boolean;
}

/** Waits this long after the last keystroke before the page updates. */
const TYPE_DELAY_MS = 120;
const ICON = { size: 16, strokeWidth: 1.5 } as const;

/** Ways to fill the field in one click: longer versions of its own text, or real-world text. */
type Fill = 'longer' | 'muchLonger' | Extract<PresetKind, 'longName' | 'url' | 'longText'>;
const FILLS: readonly Fill[] = ['longer', 'muchLonger', 'longName', 'url', 'longText'];

function fillLabel(fill: Fill): string {
  switch (fill) {
    case 'longer':
      return i18n.t('try.longer');
    case 'muchLonger':
      return i18n.t('try.muchLonger');
    case 'longName':
      return i18n.t('try.name');
    case 'url':
      return i18n.t('try.link');
    case 'longText':
      return i18n.t('try.paragraph');
  }
}

const chars = (length: number) => i18n.t('try.chars', length, [String(length)]);

/** The element's own text grown by whole words, the way the page-wide test grows it. */
function longer(text: string, intensity: 'realistic' | 'worst'): string {
  const target = translatedLength(textLength([text]), intensity);
  return resizeParts([text], Math.max(1, target), 1, { wholeWords: true })[0] ?? text;
}

/** Fits, or what breaks and by how much: icon and words, never color alone. */
function Outcome({ trial }: { trial: TextTrialDto }) {
  const short = Math.max(trial.overflow.x, trial.overflow.y);
  return (
    <p className="flex min-w-0 items-start gap-2 tabular-nums">
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {trial.fits ? (
          <CircleCheck {...ICON} className="text-ok" />
        ) : (
          <CircleAlert {...ICON} className="text-critical" />
        )}
      </span>
      <span>
        {trial.fits || trial.breaksAs === null
          ? i18n.t('try.fits', [chars(trial.length)])
          : i18n.t('try.breaks', [kindLabel(trial.breaksAs), chars(trial.length), formatPx(short)])}
      </span>
    </p>
  );
}

/**
 * Your own text in an element, live: type or paste, or fill the field in one
 * click. The field holds exactly what's on the page, so every fill can be
 * edited further, and the element gets its own text back when this goes away.
 */
export function TextTrial({ initialText, onTry, focusOnOpen = false }: TextTrialProps) {
  const id = useId();
  const [text, setText] = useState(initialText);
  const [trial, setTrial] = useState<TextTrialDto | null>(null);
  // The fill last used, and which of its examples is showing (each press shows the next).
  const [fill, setFill] = useState<{ kind: Fill; index: number } | null>(null);
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

  // Leaving (another problem, going back) puts the element's own text back.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void onTry(null);
    },
    [onTry],
  );

  const choose = (kind: Fill) => {
    const index = fill?.kind === kind ? fill.index + 1 : 0;
    setFill({ kind, index });
    apply(
      kind === 'longer'
        ? longer(initialText, 'realistic')
        : kind === 'muchLonger'
          ? longer(initialText, 'worst')
          : getPreset(kind, index),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{i18n.t('try.label')}</span>
          <span className="text-small text-fg-muted tabular-nums">{chars(textLength([text]))}</span>
        </label>
        <textarea
          id={id}
          value={text}
          rows={2}
          spellCheck={false}
          autoComplete="off"
          ref={fieldRef}
          onChange={(event) => {
            setFill(null);
            apply(event.target.value, TYPE_DELAY_MS);
          }}
          className="field-sizing-content max-h-40 min-h-16 w-full resize-none rounded-control border border-line-strong bg-raised px-3 py-2 transition-[border-color] duration-(--duration-press) ease-(--ease-out) focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span aria-hidden="true" className="text-small text-fg-muted">
          {i18n.t('try.fill')}
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={i18n.t('try.fill')}>
          {FILLS.map((kind) => {
            const active = fill?.kind === kind;
            return (
              <Button
                key={kind}
                size="sm"
                // A variant, not extra classes: two backgrounds would fight over CSS order.
                variant={active ? 'ghost' : 'secondary'}
                aria-pressed={active}
                className={cx(active && 'bg-accent-soft shadow-[0_0_0_1px_var(--color-accent)]')}
                onClick={() => {
                  choose(kind);
                }}
              >
                {fillLabel(kind)}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2" aria-live="polite">
        {trial && <Outcome trial={trial} />}
        {text !== initialText && (
          <Button
            size="sm"
            variant="ghost"
            className="text-fg-muted hover:text-fg"
            icon={<RotateCcw size={14} strokeWidth={1.5} />}
            onClick={() => {
              setFill(null);
              apply(initialText);
            }}
          >
            {i18n.t('try.reset')}
          </Button>
        )}
      </div>
    </div>
  );
}
