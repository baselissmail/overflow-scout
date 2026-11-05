import { i18n } from '#i18n';

import type { Settings } from '@/storage/settings';
import { SelectField } from '@/ui/Field';

import {
  intensityDescription,
  intensityLabel,
  intensityOptions,
  languageLabel,
  languageOptions,
  strategyDescription,
  strategyLabel,
  strategyOptions,
} from './options';

interface StressOptionFieldsProps {
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
}

/**
 * Strategy, intensity and (for language samples) the language, each explained
 * on its own line under the fields. Shared by the stress form and Settings.
 * Intensity applies to every strategy, language samples included.
 */
export function StressOptionFields({ settings, onSettings }: StressOptionFieldsProps) {
  const language = settings.strategy === 'language';
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
        <SelectField
          label={i18n.t('stress.strategy')}
          value={settings.strategy}
          options={strategyOptions()}
          onChange={(strategy) => {
            onSettings({ strategy });
          }}
        />
        {language && (
          <SelectField
            label={i18n.t('stress.language')}
            value={settings.language}
            options={languageOptions()}
            onChange={(next) => {
              onSettings({ language: next });
            }}
          />
        )}
        <SelectField
          label={i18n.t('stress.intensity')}
          value={settings.intensity}
          options={intensityOptions()}
          onChange={(intensity) => {
            onSettings({ intensity });
          }}
        />
      </div>
      <ul className="flex flex-col gap-1 text-small text-fg-muted">
        <li>
          <span className="font-medium text-fg">
            {language ? languageLabel(settings.language) : strategyLabel(settings.strategy)}:
          </span>{' '}
          {strategyDescription(settings.strategy)}
        </li>
        <li>
          <span className="font-medium text-fg">{intensityLabel(settings.intensity)}:</span>{' '}
          {intensityDescription(settings.intensity)}
        </li>
      </ul>
    </>
  );
}
