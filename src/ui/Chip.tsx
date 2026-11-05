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
export function Badge({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  icon?: ReactNode;
  children: string;
}) {
  return (
    <span
      className={cx(
        // Long labels (translations) wrap inside the badge instead of pushing past the row.
        'inline-flex max-w-full min-w-0 items-center gap-1 rounded-control px-1.5 text-small font-semibold',
        TONE_SOFT[tone],
      )}
    >
      {icon !== undefined && (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      )}
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
        'inline-flex min-h-6 items-center gap-1.5 rounded-control border px-2 text-small',
        'transition-[background-color,border-color] duration-(--duration-press) ease-(--ease-out)',
        pressed ? 'border-accent bg-accent-soft' : 'border-line bg-raised hover:bg-surface',
        className,
      )}
      {...props}
    >
      <span className={cx('inline-flex', TONE_TEXT[tone])} aria-hidden="true">
        {icon ?? <span className="size-2 rounded-full bg-current" />}
      </span>
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{count}</span>
    </button>
  );
}
