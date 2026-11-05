import { i18n } from '#i18n';

import type { Settings } from '@/storage/settings';
import { Button } from '@/ui/Button';
import { SelectField } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Switch } from '@/ui/Switch';

import { intensityOptions, languageOptions, strategyDescription, strategyOptions } from './options';

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
      className="flex animate-enter flex-col gap-3 rounded-card border border-line p-3"
      aria-label={i18n.t('stress.heading')}
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
        <SelectField
          label={i18n.t('stress.strategy')}
          value={settings.strategy}
          options={strategyOptions()}
          onChange={(strategy) => {
            onSettings({ strategy });
          }}
        />
        {settings.strategy === 'language' ? (
          <SelectField
            label={i18n.t('stress.language')}
            value={settings.language}
            options={languageOptions()}
            onChange={(language) => {
              onSettings({ language });
            }}
          />
        ) : (
          <SelectField
            label={i18n.t('stress.intensity')}
            value={settings.intensity}
            options={intensityOptions()}
            onChange={(intensity) => {
              onSettings({ intensity });
            }}
          />
        )}
      </div>
      <p className="text-small text-fg-muted">{strategyDescription(settings.strategy)}</p>
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
      </div>
      <Button type="submit" variant="primary" disabled={busy}>
        {i18n.t('stress.apply')}
      </Button>
    </form>
  );
}
