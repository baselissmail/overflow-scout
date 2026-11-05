import type { ButtonHTMLAttributes } from 'react';

import { cx } from './cx';

export type Tone = 'critical' | 'warning' | 'notice' | 'ok' | 'neutral';

export const TONE_TEXT: Readonly<Record<Tone, string>> = {
  critical: 'text-critical',
  warning: 'text-warning',
  notice: 'text-notice',
  ok: 'text-ok',
  neutral: 'text-fg-muted',
};

export const TONE_SOFT: Readonly<Record<Tone, string>> = {
  critical: 'bg-critical-soft text-critical',
  warning: 'bg-warning-soft text-warning',
  notice: 'bg-notice-soft text-notice',
  ok: 'bg-ok-soft text-ok',
  neutral: 'bg-surface text-fg-muted',
};

/** A status label: always color and text, never color alone. */
export function Badge({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span className={cx('rounded-control px-1.5 text-small font-semibold', TONE_SOFT[tone])}>
      {children}
    </span>
  );
}

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  tone: Tone;
  label: string;
  count: number;
  pressed: boolean;
}

/** A summary count that doubles as a filter toggle. */
export function Chip({ tone, label, count, pressed, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx(
        'inline-flex min-h-6 items-center gap-1.5 rounded-control border px-2 text-small',
        'transition-[background-color,border-color] duration-(--duration-press) ease-(--ease-out)',
        pressed ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface',
        className,
      )}
      {...props}
    >
      <span className={cx('size-2 rounded-full bg-current', TONE_TEXT[tone])} aria-hidden="true" />
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{count}</span>
    </button>
  );
}
