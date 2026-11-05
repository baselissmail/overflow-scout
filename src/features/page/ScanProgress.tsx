import { i18n } from '#i18n';

import { formatCount } from '@/features/results/labels';
import { Button } from '@/ui/Button';
import { ProgressBar } from '@/ui/ProgressBar';

import type { PanelState } from './controller';

function phaseLabel(state: PanelState): string {
  if (state.connection === 'connecting') return i18n.t('busy.connecting');
  switch (state.progress?.phase) {
    case 'baseline':
      return i18n.t('busy.baseline');
    case 'apply':
      return i18n.t('busy.apply');
    case 'stressed':
      return i18n.t('busy.stressed');
    case 'scan':
      return i18n.t('busy.scanning');
    case undefined:
      break;
  }
  switch (state.busy) {
    case 'stress':
    case 'reapply':
      return i18n.t('busy.baseline');
    case 'revert':
      return i18n.t('busy.reverting');
    case 'connect':
    case 'scan':
    case null:
      return i18n.t('busy.scanning');
  }
}

/** A thin bar, the phase, a live count, and Cancel (plan §5.3). */
export function ScanProgress({ state, onCancel }: { state: PanelState; onCancel: () => void }) {
  const label = phaseLabel(state);
  const count = state.progress?.textNodes ?? 0;
  const countText = i18n.t('busy.textNodes', count, [formatCount(count)]);
  const cancellable = state.busy === 'scan' || state.busy === 'stress';
  return (
    <section className="flex flex-col gap-2" aria-label={label}>
      <ProgressBar label={label} valueText={countText} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0" role="status" aria-live="polite">
          {label}{' '}
          <span className="text-fg-muted tabular-nums">{state.progress ? countText : ''}</span>
        </p>
        {cancellable && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {i18n.t('actions.cancel')}
          </Button>
        )}
      </div>
    </section>
  );
}
