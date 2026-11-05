import type { Tone } from './Chip';
import { TONE_TEXT } from './Chip';
import { cx } from './cx';

export interface MeasureBarProps {
  /** What the box offers (px or characters). */
  has: number;
  /** What the text needs. */
  needs: number;
  tone: Tone;
  /** Visible labels, already formatted: "has 120 px", "needs 214 px", "−94 px". */
  hasLabel: string;
  needsLabel: string;
  differenceLabel: string;
  /** The whole measurement in words, for screen readers. */
  description: string;
}

/**
 * The measure bar: a ruler, not a progress bar (docs/design/DIRECTION.md).
 * The solid track is the box; the hatched part past its end is the text that
 * doesn't fit, like a print bleed. Ticks every 10 % of the longer of the two.
 */
export function MeasureBar({
  has,
  needs,
  tone,
  hasLabel,
  needsLabel,
  differenceLabel,
  description,
}: MeasureBarProps) {
  const span = Math.max(has, needs, 1);
  const hasPct = (has / span) * 100;
  const needsPct = (needs / span) * 100;
  const overflows = needs > has;

  return (
    <div role="img" aria-label={description} className="flex flex-col gap-1.5">
      <div className="relative h-4 w-full">
        <div
          className="absolute inset-x-0 bottom-0 h-1.5"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, var(--color-line-strong) 0 1px, transparent 1px 10%)',
          }}
        />
        <div
          className="absolute inset-y-0 start-0 origin-left animate-grow rounded-s-[3px] border-e-2 border-fg bg-fg/12 rtl:origin-right"
          style={{ width: `${String(hasPct)}%` }}
        />
        {overflows ? (
          <div
            className={cx('bg-hatch absolute inset-y-0 rounded-e-[3px]', TONE_TEXT[tone])}
            style={{
              insetInlineStart: `${String(hasPct)}%`,
              width: `${String(needsPct - hasPct)}%`,
            }}
          />
        ) : (
          <div
            className="absolute inset-y-1 start-0 rounded-s-[2px] bg-ok/50"
            style={{ width: `${String(needsPct)}%` }}
          />
        )}
      </div>
      <p
        className="flex flex-wrap justify-between gap-x-3 font-mono text-small tabular-nums"
        aria-hidden="true"
      >
        <span>{hasLabel}</span>
        <span>{needsLabel}</span>
        <span className={cx('font-semibold', overflows ? TONE_TEXT[tone] : 'text-ok')}>
          {differenceLabel}
        </span>
      </p>
    </div>
  );
}
