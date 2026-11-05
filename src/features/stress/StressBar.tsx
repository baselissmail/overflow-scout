import { i18n } from '#i18n';
import { RotateCcw } from 'lucide-react';

import { Button } from '@/ui/Button';

interface StressBarProps {
  pending: number;
  busy: boolean;
  onRevert: () => void;
  onReapply: () => void;
}

/** Shown while stress text is on the page: the page is never left modified silently. */
export function StressBar({ pending, busy, onRevert, onReapply }: StressBarProps) {
  return (
    <section
      className="flex animate-enter flex-col gap-2 rounded-card border border-warning bg-warning-soft p-3 text-fg"
      aria-label={i18n.t('stress.heading')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 font-medium">{i18n.t('stress.active')}</p>
        <Button
          variant="danger"
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
