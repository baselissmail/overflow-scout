import * as z from 'zod/mini';
import { storage } from 'wxt/utils/storage';

import { SAMPLE_LANGUAGES, STRESS_INTENSITIES, STRESS_STRATEGIES } from '@/core';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const settingsSchema = z.object({
  theme: z.enum(THEMES),
  strategy: z.enum(STRESS_STRATEGIES),
  intensity: z.enum(STRESS_INTENSITIES),
  language: z.enum(SAMPLE_LANGUAGES),
  rtl: z.boolean(),
  includeInputs: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  strategy: 'translation',
  // Realistic: the length most translations reach, so findings are the ones worth fixing.
  intensity: 'realistic',
  language: 'de',
  rtl: false,
  includeInputs: true,
};

/** Keeps every valid stored field and falls back to the default for the rest. */
export function normalizeSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS;
  const stored = value as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const candidate = { ...DEFAULT_SETTINGS, [key]: stored[key] };
    if (settingsSchema.safeParse(candidate).success) merged[key] = stored[key];
  }
  return settingsSchema.parse(merged);
}

/**
 * Stored in `chrome.storage.local`, not `sync`: the extension promises that
 * nothing leaves the device, and Chrome sync would upload settings.
 */
export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});
