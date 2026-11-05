import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('falls back to defaults for missing or corrupt data', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('dark')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields and replaces invalid ones', () => {
    expect(normalizeSettings({ theme: 'dark', strategy: 'shout', rtl: true, extra: 1 })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      rtl: true,
    });
  });
});
