import * as z from 'zod/mini';
import { storage } from 'wxt/utils/storage';

import { FINDING_KINDS } from '@/core';

/**
 * A result someone chose to ignore on one site (plan §3.6): the issue's
 * fingerprint (kind + element + parent), which stays the same across scans.
 */
const ruleSchema = z.object({
  site: z.string(),
  issueId: z.string(),
  kind: z.enum(FINDING_KINDS),
  /** The element, as shown when it was ignored (`nav > a.tab`). */
  label: z.string(),
  at: z.number(),
});

export type IgnoreRule = z.infer<typeof ruleSchema>;

/** Keeps every valid stored rule and drops the rest (and duplicates). */
export function normalizeRules(value: unknown): IgnoreRule[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    const parsed = ruleSchema.safeParse(entry);
    if (!parsed.success) return [];
    const key = `${parsed.data.site} ${parsed.data.issueId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [parsed.data];
  });
}

/**
 * The site a rule belongs to: the page's origin, `file://` for local files,
 * or the extension's own pages (the demo). Null for anything else.
 */
export function siteOf(url: string): string | null {
  try {
    const { protocol, host, origin } = new URL(url);
    if (protocol === 'file:') return 'file://';
    if (protocol === 'chrome-extension:') return `chrome-extension://${host}`;
    return protocol === 'http:' || protocol === 'https:' ? origin : null;
  } catch {
    return null;
  }
}

export function withRule(rules: readonly IgnoreRule[], rule: IgnoreRule): IgnoreRule[] {
  return normalizeRules([...rules, rule]);
}

export function withoutRule(
  rules: readonly IgnoreRule[],
  site: string,
  issueId: string,
): IgnoreRule[] {
  return rules.filter((rule) => rule.site !== site || rule.issueId !== issueId);
}

/** Stored on this device only (`local`), like the settings. */
export const ignoreItem = storage.defineItem<IgnoreRule[]>('local:ignored', {
  fallback: [],
  version: 1,
});
