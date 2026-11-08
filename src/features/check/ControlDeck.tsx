import { i18n } from '#i18n';
import { MousePointerClick, ScanText } from 'lucide-react';
import { useId, useState } from 'react';

import { SCALE_LIMITS } from '@/core';
import { Button } from '@/ui/Button';
import { Segmented } from '@/ui/Segmented';

import type { TextLength } from './length';
import { TEXT_LENGTHS, formatScale, lengthHint, lengthLabel } from './length';

const ICON = { size: 16, strokeWidth: 1.5 } as const;

/**
 * How many times as long a custom test makes the text. Typing doesn't touch
 * the page; Apply (or Enter) does, since a test of the whole page takes a moment.
 */
function ScaleField({
  scale,
  disabled,
  hintId,
  onApply,
}: {
  scale: number;
  disabled: boolean;
  hintId: string;
  onApply: (scale: number) => void;
}) {
  const errorId = useId();
  const [draft, setDraft] = useState(() => formatScale(scale));
  const value = Number(draft);
  const valid =
    draft.trim() !== '' &&
    Number.isFinite(value) &&
    value >= SCALE_LIMITS.min &&
    value <= SCALE_LIMITS.max;
  return (
    // The range is checked here, with a message in words; the browser's own
    // check would also refuse any number off its step, without saying so.
    <form
      noValidate
      className="flex flex-wrap items-center gap-x-2 gap-y-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && value !== scale) onApply(value);
      }}
    >
      <label className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={SCALE_LIMITS.min}
          max={SCALE_LIMITS.max}
          step="any"
          value={draft}
          aria-invalid={!valid}
          aria-describedby={valid ? hintId : errorId}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          className="min-h-8 w-16 rounded-control border border-line-strong bg-raised px-2 tabular-nums transition-[border-color] duration-(--duration-press) ease-(--ease-out) focus:border-accent aria-invalid:border-critical"
        />
        <span>{i18n.t('length.times')}</span>
      </label>
      <Button size="sm" type="submit" disabled={disabled || !valid || value === scale}>
        {i18n.t('length.apply')}
      </Button>
      {!valid && (
        <p id={errorId} className="w-full text-small text-critical">
          {i18n.t('length.scaleRange', [
            formatScale(SCALE_LIMITS.min),
            formatScale(SCALE_LIMITS.max),
          ])}
        </p>
      )}
    </form>
  );
}

interface ControlDeckProps {
  /** The length the page's text is at (or is going to, while that runs). */
  length: TextLength;
  /** Times as long, for the custom length. */
  scale: number;
  hasResults: boolean;
  busy: boolean;
  /** No tab to work on. */
  disabled: boolean;
  picking: boolean;
  /** Texts the page changed back while longer text was on. */
  pending: number;
  onCheck: () => void;
  onLength: (length: TextLength) => void;
  onScale: (scale: number) => void;
  onPick: () => void;
  onCancelPick: () => void;
  onReapply: () => void;
}

/**
 * The three things the panel does, always in the same place: check the page,
 * try your own text in one element, and set how long the page's text is.
 * The length control shows the page's state, so going back is the same control.
 */
export function ControlDeck({
  length,
  scale,
  hasResults,
  busy,
  disabled,
  picking,
  pending,
  onCheck,
  onLength,
  onScale,
  onPick,
  onCancelPick,
  onReapply,
}: ControlDeckProps) {
  const off = busy || disabled;
  const hintId = useId();

  if (picking) {
    // Waiting for a click on the page: say so where the eye already is, with the way out.
    return (
      <section
        className="flex animate-enter items-center gap-3 rounded-card bg-accent-soft p-3 shadow-[0_0_0_1px_var(--color-accent)]"
        aria-label={i18n.t('try.heading')}
      >
        <MousePointerClick {...ICON} aria-hidden="true" className="shrink-0 text-accent" />
        <p className="min-w-0 flex-1" role="status">
          {i18n.t('picking.hint')}
        </p>
        <Button size="sm" aria-keyshortcuts="Escape" onClick={onCancelPick}>
          {i18n.t('actions.stopPicking')}
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={<ScanText {...ICON} />} disabled={off} onClick={onCheck}>
          {hasResults ? i18n.t('actions.scanAgain') : i18n.t('actions.scan')}
        </Button>
        <Button icon={<MousePointerClick {...ICON} />} disabled={off} onClick={onPick}>
          {i18n.t('actions.tryText')}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        {/* The group is named by its aria-label; this is the same words, for the eye. */}
        <span aria-hidden="true" className="font-medium">
          {i18n.t('length.label')}
        </span>
        <Segmented<TextLength>
          label={i18n.t('length.label')}
          size="md"
          value={length}
          disabled={off}
          options={TEXT_LENGTHS.map((value) => ({ value, label: lengthLabel(value) }))}
          onChange={onLength}
        />
        {length === 'custom' && (
          // A new scale from outside (another tab) starts the field over.
          <ScaleField key={scale} scale={scale} disabled={off} hintId={hintId} onApply={onScale} />
        )}
        <p id={hintId} className="text-small text-pretty text-fg-muted">
          {lengthHint(length, scale)}
        </p>
        {pending > 0 && (
          <p
            className="mt-1 flex flex-wrap items-center justify-between gap-2 text-small"
            role="status"
          >
            <span>{i18n.t('page.reset', pending, [String(pending)])}</span>
            <Button size="sm" disabled={busy} onClick={onReapply}>
              {i18n.t('actions.reapply')}
            </Button>
          </p>
        )}
      </div>
    </section>
  );
}
