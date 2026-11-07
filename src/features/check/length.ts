import { i18n } from '#i18n';

import type { StressIntensity } from '@/core';
import type { StressOptionsDto } from '@/messaging/protocol';

/**
 * How long the page's text is: its own (normal), or grown by repeating its
 * own words to a typical translation's length, or to the longest ones.
 */
export type TextLength = 'normal' | Extract<StressIntensity, 'realistic' | 'worst'>;

export const TEXT_LENGTHS = ['normal', 'realistic', 'worst'] as const satisfies TextLength[];

export function lengthLabel(length: TextLength | StressIntensity): string {
  switch (length) {
    case 'normal':
      return i18n.t('length.normal');
    case 'realistic':
      return i18n.t('length.realistic');
    // Not offered in the panel; reports from the API may still name it.
    case 'worst':
    case 'extreme':
      return i18n.t('length.worst');
  }
}

/** What the page shows at this length, and how to get back. */
export function lengthHint(length: TextLength): string {
  switch (length) {
    case 'normal':
      return i18n.t('length.hintNormal');
    case 'realistic':
      return i18n.t('length.hintRealistic');
    case 'worst':
      return i18n.t('length.hintWorst');
  }
}

/** The page-wide test for a length: the text's own words, so it stays readable English. */
export function stressOptions(length: Exclude<TextLength, 'normal'>): StressOptionsDto {
  // The protocol needs a language; only the language-sample strategy reads it.
  return { strategy: 'translation', intensity: length, language: 'de', rtl: false };
}
