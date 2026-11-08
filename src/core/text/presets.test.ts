import { describe, expect, it } from 'vitest';

import { PRESET_KINDS, PRESET_POOLS, getPreset } from './presets';

const RESERVED_HOST = /(^|\.)(example|example\.com|example\.net|example\.org)$/;

describe('PRESET_POOLS', () => {
  it('lists every pool exactly once in PRESET_KINDS', () => {
    expect([...PRESET_KINDS].sort()).toEqual(Object.keys(PRESET_POOLS).sort());
  });

  it.each(PRESET_KINDS)('%s has at least 8 unique, trimmed entries', (kind) => {
    const pool: readonly string[] = PRESET_POOLS[kind];
    expect(pool.length).toBeGreaterThanOrEqual(8);
    expect(new Set(pool).size).toBe(pool.length);
    for (const entry of pool) expect(entry).toBe(entry.trim());
  });

  it('uses plain ASCII only, as the panel shows these', () => {
    for (const kind of PRESET_KINDS) {
      for (const entry of PRESET_POOLS[kind]) expect(entry).toMatch(/^[\x20-\x7e]+$/);
    }
  });

  it('only uses reserved domains for URLs', () => {
    for (const url of PRESET_POOLS.url) {
      expect(new URL(url).hostname).toMatch(RESERVED_HOST);
    }
  });

  it('only uses reserved domains for emails', () => {
    for (const email of PRESET_POOLS.email) {
      const domain = email.split('@')[1] ?? '';
      expect(new URL(`https://${domain}`).hostname).toMatch(RESERVED_HOST);
    }
  });
});

describe('getPreset', () => {
  it('returns entries in order', () => {
    expect(getPreset('url', 0)).toBe(PRESET_POOLS.url[0]);
    expect(getPreset('url', 1)).toBe(PRESET_POOLS.url[1]);
  });

  it('wraps around past the end and before the start', () => {
    const size = PRESET_POOLS.email.length;
    expect(getPreset('email', size)).toBe(PRESET_POOLS.email[0]);
    expect(getPreset('email', -1)).toBe(PRESET_POOLS.email[size - 1]);
  });

  it('truncates fractional indexes', () => {
    expect(getPreset('product', 1.9)).toBe(PRESET_POOLS.product[1]);
  });
});
