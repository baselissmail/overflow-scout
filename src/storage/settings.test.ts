import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('falls back to defaults for missing or corrupt data', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('dark')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields and replaces invalid ones', () => {
    expect(normalizeSettings({ theme: 'dark', includeInputs: 'no', extra: 1 })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
    });
  });

  it('keeps a custom length only within its limits', () => {
    expect(normalizeSettings({ customScale: 3.5 }).customScale).toBe(3.5);
    expect(normalizeSettings({ customScale: 1 }).customScale).toBe(DEFAULT_SETTINGS.customScale);
    expect(normalizeSettings({ customScale: 50 }).customScale).toBe(DEFAULT_SETTINGS.customScale);
  });

  it('drops the longer-text options older versions stored', () => {
    expect(normalizeSettings({ theme: 'light', strategy: 'pseudo', rtl: true })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'light',
    });
  });
});
