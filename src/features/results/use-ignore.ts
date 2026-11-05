import { useCallback, useEffect, useState } from 'react';

import type { IssueDto } from '@/messaging/protocol';
import type { IgnoreRule } from '@/storage/ignore';
import { ignoreItem, normalizeRules, withRule, withoutRule } from '@/storage/ignore';

export interface IgnoreRules {
  rules: IgnoreRule[];
  ignore: (site: string, issue: IssueDto, label: string) => void;
  unignore: (site: string, issueId: string) => void;
}

/** The fingerprints of the issues ignored on a site. */
export function ignoredOn(rules: readonly IgnoreRule[], site: string | null): ReadonlySet<string> {
  return new Set(
    site === null ? [] : rules.filter((rule) => rule.site === site).map((rule) => rule.issueId),
  );
}

/** Ignore rules from storage, kept in sync across open panels; changes save immediately. */
export function useIgnoreRules(): IgnoreRules {
  const [rules, setRules] = useState<IgnoreRule[]>([]);

  useEffect(() => {
    let current = true;
    void ignoreItem.getValue().then((value) => {
      if (current) setRules(normalizeRules(value));
    });
    const unwatch = ignoreItem.watch((value) => {
      setRules(normalizeRules(value));
    });
    return () => {
      current = false;
      unwatch();
    };
  }, []);

  const save = useCallback((change: (rules: IgnoreRule[]) => IgnoreRule[]) => {
    setRules((previous) => {
      const next = change(previous);
      void ignoreItem.setValue(next);
      return next;
    });
  }, []);

  const ignore = useCallback(
    (site: string, issue: IssueDto, label: string) => {
      save((rules) =>
        withRule(rules, { site, issueId: issue.id, kind: issue.kind, label, at: Date.now() }),
      );
    },
    [save],
  );
  const unignore = useCallback(
    (site: string, issueId: string) => {
      save((rules) => withoutRule(rules, site, issueId));
    },
    [save],
  );

  return { rules, ignore, unignore };
}
