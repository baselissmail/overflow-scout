import type { ButtonHTMLAttributes, ReactNode } from 'react';

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

export const TONE_BG: Readonly<Record<Tone, string>> = {
  critical: 'bg-critical',
  warning: 'bg-warning',
  notice: 'bg-notice',
  ok: 'bg-ok',
  neutral: 'bg-fg-muted',
};

/** A status label: icon, color and text, never color alone. */
/**
 * A category with its severity: a small colored dot and the words. Color marks
 * the dot only, so a list of results doesn't light up (and the words carry the
 * meaning, never the color alone). Long labels wrap.
 */
export function Badge({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 text-small font-medium text-fg">
      <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', TONE_BG[tone])} />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  tone: Tone;
  icon?: ReactNode;
  label: string;
  count: number;
  pressed: boolean;
}

/** A summary count that doubles as a filter toggle. */
export function Chip({ tone, icon, label, count, pressed, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx(
        'inline-flex min-h-7 items-center gap-1.5 rounded-control px-2.5 text-small',
        'transition-[background-color,color] duration-(--duration-press) ease-(--ease-out)',
        pressed
          ? 'bg-accent-soft text-fg shadow-[0_0_0_1px_var(--color-accent)]'
          : 'bg-raised text-fg shadow-raised hover:bg-surface',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', TONE_BG[tone])} />
      {icon !== undefined && (
        <span className="inline-flex text-fg-muted" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{label}</span>
      <span className="text-fg-muted tabular-nums">{count}</span>
    </button>
  );
}
