import { i18n } from '#i18n';
import { RotateCcw } from 'lucide-react';

import type { StressStrategy } from '@/core';
import { Button } from '@/ui/Button';

interface StressBarProps {
  /** Which strategy is on the page, to explain the odd-looking text. */
  strategy: StressStrategy;
  pending: number;
  busy: boolean;
  /** The options form is open under the bar. */
  optionsOpen: boolean;
  onRevert: () => void;
  onReapply: () => void;
  onOptions: () => void;
}

/** Why the text looks the way it does, so it isn't mistaken for a broken page. */
function explanation(strategy: StressStrategy): string {
  switch (strategy) {
    case 'translation':
      return i18n.t('stress.activeTranslation');
    case 'pseudo':
      return i18n.t('stress.activePseudo');
    case 'long-words':
      return i18n.t('stress.activeLongWords');
    case 'language':
      return i18n.t('stress.activeLanguage');
  }
}

/** Shown while stress text is on the page: the page is never left modified silently. */
export function StressBar({
  strategy,
  pending,
  busy,
  optionsOpen,
  onRevert,
  onReapply,
  onOptions,
}: StressBarProps) {
  return (
    <section
      className="flex animate-enter flex-col gap-2 rounded-card bg-raised p-3 shadow-raised"
      aria-label={i18n.t('stress.heading')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          {/* The page is changed: the one warning mark on the panel. */}
          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
          <div className="min-w-0">
            <p className="font-medium">{i18n.t('stress.active')}</p>
            <p className="text-small text-fg-muted">{explanation(strategy)}</p>
            {/* The results below name the options used; this is the way to change them. */}
            <button
              type="button"
              aria-expanded={optionsOpen}
              className="mt-1 text-small text-accent underline decoration-accent/40 underline-offset-[3px] hover:decoration-accent"
              onClick={onOptions}
            >
              {i18n.t('stress.change')}
            </button>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={busy}
          icon={<RotateCcw size={14} strokeWidth={1.5} />}
          onClick={onRevert}
        >
          {i18n.t('actions.revert')}
        </Button>
      </div>
      {pending > 0 && (
        <p
          className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-small"
          role="status"
        >
          <span>{i18n.t('page.reset', pending, [String(pending)])}</span>
          <Button size="sm" disabled={busy} onClick={onReapply}>
            {i18n.t('actions.reapply')}
          </Button>
        </p>
      )}
    </section>
  );
}
