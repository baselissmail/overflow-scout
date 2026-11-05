import { i18n } from '#i18n';
import { RotateCcw } from 'lucide-react';

import type { StressStrategy } from '@/core';
import { Button } from '@/ui/Button';

interface StressBarProps {
  /** Which strategy is on the page, to explain the odd-looking text. */
  strategy: StressStrategy;
  pending: number;
  busy: boolean;
  onRevert: () => void;
  onReapply: () => void;
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
export function StressBar({ strategy, pending, busy, onRevert, onReapply }: StressBarProps) {
  return (
    <section
      className="flex animate-enter flex-col gap-2 rounded-card border border-warning bg-warning-soft p-3 text-fg"
      aria-label={i18n.t('stress.heading')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{i18n.t('stress.active')}</p>
          <p className="text-small">{explanation(strategy)}</p>
        </div>
        <Button
          variant="primary"
          disabled={busy}
          icon={<RotateCcw size={16} strokeWidth={1.5} />}
          onClick={onRevert}
        >
          {i18n.t('actions.revert')}
        </Button>
      </div>
      {pending > 0 && (
        <p className="flex flex-wrap items-center justify-between gap-2" role="status">
          <span>{i18n.t('page.reset', pending, [String(pending)])}</span>
          <Button size="sm" disabled={busy} onClick={onReapply}>
            {i18n.t('actions.reapply')}
          </Button>
        </p>
      )}
    </section>
  );
}
