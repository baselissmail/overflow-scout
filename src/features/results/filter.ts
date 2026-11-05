import type { IssueDto } from '@/messaging/protocol';

import type { Kind } from './labels';

export type SortOrder = 'severity' | 'page';

export interface ResultFilter {
  /** Kinds to show; empty shows every kind. */
  kinds: ReadonlySet<Kind>;
  query: string;
  sort: SortOrder;
}

export const NO_FILTER: ResultFilter = { kinds: new Set(), query: '', sort: 'severity' };

/** Issues per kind, for the summary chips. */
export function countByKind(issues: readonly IssueDto[]): Map<Kind, number> {
  const counts = new Map<Kind, number>();
  for (const issue of issues) counts.set(issue.kind, (counts.get(issue.kind) ?? 0) + 1);
  return counts;
}

function matches(issue: IssueDto, query: string): boolean {
  return issue.instances.some(
    (finding) =>
      finding.text.toLowerCase().includes(query) ||
      finding.element.label.toLowerCase().includes(query) ||
      (finding.element.selector?.toLowerCase().includes(query) ?? false),
  );
}

/**
 * Filters and sorts issues. They arrive sorted by severity, then page order,
 * so "severity" keeps the order and "page" sorts by first appearance.
 */
export function applyFilter(issues: readonly IssueDto[], filter: ResultFilter): IssueDto[] {
  const query = filter.query.trim().toLowerCase();
  const kept = issues.filter(
    (issue) =>
      (filter.kinds.size === 0 || filter.kinds.has(issue.kind)) &&
      (query === '' || matches(issue, query)),
  );
  return filter.sort === 'page' ? kept.sort((a, b) => a.order - b.order) : kept;
}
