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
