import { i18n } from '#i18n';

import type { Settings } from '@/storage/settings';
import { Button } from '@/ui/Button';
import { Segmented } from '@/ui/Segmented';
import { Switch } from '@/ui/Switch';

import { StressOptionFields } from './StressOptionFields';

export type StressScope = 'page' | 'picked';

interface StressControlsProps {
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
  scope: StressScope;
  onScope: (scope: StressScope) => void;
  /** An element has been picked, so the stress test can be limited to it. */
  canScopeToPicked: boolean;
  busy: boolean;
  onApply: () => void;
}

/** The last options used become the defaults (also editable in Settings). */
export function StressControls({
  settings,
  onSettings,
  scope,
  onScope,
  canScopeToPicked,
  busy,
  onApply,
}: StressControlsProps) {
  return (
    <form
      className="flex animate-enter flex-col gap-3 rounded-card bg-raised p-3 shadow-raised"
      aria-label={i18n.t('stress.heading')}
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <StressOptionFields settings={settings} onSettings={onSettings} />
      <Switch
        label={i18n.t('stress.rtl')}
        description={i18n.t('stress.rtlDescription')}
        checked={settings.rtl}
        onChange={(rtl) => {
          onSettings({ rtl });
        }}
      />
      <div className="flex flex-col gap-1">
        <span className="text-small text-fg-muted">{i18n.t('stress.scope')}</span>
        <Segmented<StressScope>
          label={i18n.t('stress.scope')}
          value={scope}
          onChange={onScope}
          options={[
            { value: 'page', label: i18n.t('stress.scopePage') },
            { value: 'picked', label: i18n.t('stress.scopePicked'), disabled: !canScopeToPicked },
          ]}
        />
        {!canScopeToPicked && (
          <span className="text-small text-fg-muted">{i18n.t('stress.scopePickedHint')}</span>
        )}
      </div>
      <Button type="submit" variant="primary" disabled={busy}>
        {i18n.t('stress.apply')}
      </Button>
    </form>
  );
}
