import { i18n } from '#i18n';

import type { SampleLanguage, StressIntensity, StressStrategy } from '@/core';
import { SAMPLE_LANGUAGES, STRESS_INTENSITIES, STRESS_STRATEGIES } from '@/core';

export function strategyLabel(strategy: StressStrategy): string {
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
}

export function strategyDescription(strategy: StressStrategy): string {
  switch (strategy) {
    case 'translation':
      return i18n.t('strategyDescription.translation');
    case 'pseudo':
      return i18n.t('strategyDescription.pseudo');
    case 'long-words':
      return i18n.t('strategyDescription.longWords');
    case 'language':
      return i18n.t('strategyDescription.language');
  }
}

export function intensityDescription(intensity: StressIntensity): string {
  switch (intensity) {
    case 'realistic':
      return i18n.t('intensityDescription.realistic');
    case 'worst':
      return i18n.t('intensityDescription.worst');
    case 'extreme':
      return i18n.t('intensityDescription.extreme');
  }
}

export function intensityLabel(intensity: StressIntensity): string {
  switch (intensity) {
    case 'realistic':
      return i18n.t('intensity.realistic');
    case 'worst':
      return i18n.t('intensity.worst');
    case 'extreme':
      return i18n.t('intensity.extreme');
  }
}

export function languageLabel(language: SampleLanguage): string {
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
}

export const strategyOptions = () =>
  STRESS_STRATEGIES.map((value) => ({ value, label: strategyLabel(value) }));
export const intensityOptions = () =>
  STRESS_INTENSITIES.map((value) => ({ value, label: intensityLabel(value) }));
export const languageOptions = () =>
  SAMPLE_LANGUAGES.map((value) => ({ value, label: languageLabel(value) }));
