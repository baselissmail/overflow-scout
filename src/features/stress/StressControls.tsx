import { i18n } from '#i18n';
import { useId, useState } from 'react';

import type { SampleLanguage, StressIntensity, StressStrategy } from '@/core';
import { SAMPLE_LANGUAGES, STRESS_INTENSITIES, STRESS_STRATEGIES } from '@/core';
import type { StressOptionsDto } from '@/messaging/protocol';

const strategyLabel = (strategy: StressStrategy): string => {
  switch (strategy) {
    case 'translation':
      return i18n.t('strategy.translation');
    case 'pseudo':
      return i18n.t('strategy.pseudo');
    case 'long-words':
      return i18n.t('strategy.longWords');
    case 'language':
      return i18n.t('strategy.language');
  }
};

const intensityLabel = (intensity: StressIntensity): string => {
  switch (intensity) {
    case 'realistic':
      return i18n.t('intensity.realistic');
    case 'worst':
      return i18n.t('intensity.worst');
    case 'extreme':
      return i18n.t('intensity.extreme');
  }
};

const languageLabel = (language: SampleLanguage): string => {
  switch (language) {
    case 'de':
      return i18n.t('language.de');
    case 'fi':
      return i18n.t('language.fi');
    case 'ru':
      return i18n.t('language.ru');
    case 'ar':
      return i18n.t('language.ar');
    case 'ja':
      return i18n.t('language.ja');
    case 'th':
      return i18n.t('language.th');
  }
};

const fieldClass = 'w-full rounded-control border border-line bg-canvas px-2 py-1.5 text-fg';

interface StressControlsProps {
  busy: boolean;
  onApply: (options: StressOptionsDto) => void;
}

export function StressControls({ busy, onApply }: StressControlsProps) {
  const id = useId();
  const [options, setOptions] = useState<StressOptionsDto>({
    strategy: 'translation',
    intensity: 'worst',
    language: 'de',
    rtl: false,
  });
  const update = (patch: Partial<StressOptionsDto>) => {
    setOptions((current) => ({ ...current, ...patch }));
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-card border border-line p-3"
      aria-label={i18n.t('stress.heading')}
      onSubmit={(event) => {
        event.preventDefault();
        onApply(options);
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1" htmlFor={`${id}-strategy`}>
          <span className="text-small text-fg-muted">{i18n.t('stress.strategy')}</span>
          <select
            id={`${id}-strategy`}
            className={fieldClass}
            value={options.strategy}
            onChange={(event) => {
              update({ strategy: event.target.value as StressStrategy });
            }}
          >
            {STRESS_STRATEGIES.map((strategy) => (
              <option key={strategy} value={strategy}>
                {strategyLabel(strategy)}
              </option>
            ))}
          </select>
        </label>
        {options.strategy === 'language' ? (
          <label className="flex flex-col gap-1" htmlFor={`${id}-language`}>
            <span className="text-small text-fg-muted">{i18n.t('stress.language')}</span>
            <select
              id={`${id}-language`}
              className={fieldClass}
              value={options.language}
              onChange={(event) => {
                update({ language: event.target.value as SampleLanguage });
              }}
            >
              {SAMPLE_LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {languageLabel(language)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1" htmlFor={`${id}-intensity`}>
            <span className="text-small text-fg-muted">{i18n.t('stress.intensity')}</span>
            <select
              id={`${id}-intensity`}
              className={fieldClass}
              value={options.intensity}
              onChange={(event) => {
                update({ intensity: event.target.value as StressIntensity });
              }}
            >
              {STRESS_INTENSITIES.map((intensity) => (
                <option key={intensity} value={intensity}>
                  {intensityLabel(intensity)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="flex items-center gap-2" htmlFor={`${id}-rtl`}>
        <input
          id={`${id}-rtl`}
          type="checkbox"
          checked={options.rtl}
          onChange={(event) => {
            update({ rtl: event.target.checked });
          }}
        />
        {i18n.t('stress.rtl')}
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-control bg-accent px-3 py-1.5 font-semibold text-accent-fg disabled:opacity-60"
      >
        {i18n.t('stress.apply')}
      </button>
    </form>
  );
}

interface StressBarProps {
  growth: number;
  strings: number;
  pending: number;
  busy: boolean;
  onRevert: () => void;
  onReapply: () => void;
}

/** Shown while stress text is on the page: the page is never left modified silently. */
export function StressBar({ growth, strings, pending, busy, onRevert, onReapply }: StressBarProps) {
  return (
    <section
      className="flex flex-col gap-2 rounded-card border border-warning bg-warning-soft p-3"
      aria-label={i18n.t('stress.heading')}
    >
      <p className="font-medium">{i18n.t('stress.active')}</p>
      <p className="text-small text-fg-muted tabular-nums">
        {i18n.t('stress.growth', [String(strings), String(growth)])}
      </p>
      {pending > 0 && (
        <p className="flex items-center justify-between gap-2" role="status">
          <span>{i18n.t('page.reset', pending, [String(pending)])}</span>
          <button
            type="button"
            disabled={busy}
            className="rounded-control border border-line bg-canvas px-2 py-1 font-medium"
            onClick={onReapply}
          >
            {i18n.t('actions.reapply')}
          </button>
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        className="self-start rounded-control bg-fg px-3 py-1.5 font-semibold text-canvas disabled:opacity-60"
        onClick={onRevert}
      >
        {i18n.t('actions.revert')}
      </button>
    </section>
  );
}
