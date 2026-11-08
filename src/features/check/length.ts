import { i18n } from '#i18n';

import type { StressIntensity } from '@/core';
import type { StressOptionsDto } from '@/messaging/protocol';

/**
 * How long the page's text is: its own (normal), or grown by repeating its
 * own words to a typical translation's length, to the longest ones, or to a
 * custom number of times as long.
 */
export type TextLength = 'normal' | Extract<StressIntensity, 'realistic' | 'worst'> | 'custom';

export const TEXT_LENGTHS = [
  'normal',
  'realistic',
  'worst',
  'custom',
] as const satisfies TextLength[];

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
    case 'custom':
      return i18n.t('length.custom');
  }
}

/** A scale as people write it: 2, 2.5. */
export function formatScale(scale: number): string {
  return String(Math.round(scale * 10) / 10);
}

/** What the page shows at this length, and how to get back. */
export function lengthHint(length: TextLength, scale: number): string {
  switch (length) {
    case 'normal':
      return i18n.t('length.hintNormal');
    case 'realistic':
      return i18n.t('length.hintRealistic');
    case 'worst':
      return i18n.t('length.hintWorst');
    case 'custom':
      return i18n.t('length.hintCustom', [formatScale(scale)]);
  }
}

/** The page-wide test for a length: the text's own words, so it stays readable English. */
export function stressOptions(
  length: Exclude<TextLength, 'normal'>,
  scale: number,
): StressOptionsDto {
  // The protocol needs a language; only the language-sample strategy reads it.
  const base = { strategy: 'translation', language: 'de', rtl: false } as const;
  return length === 'custom'
    ? { ...base, intensity: 'worst', scale }
    : { ...base, intensity: length };
}

/** The length a test ran at, to show it the way the panel offers it. */
export function lengthOf(options: StressOptionsDto): TextLength {
  if (options.scale !== undefined) return 'custom';
  return options.intensity === 'realistic' ? 'realistic' : 'worst';
}
