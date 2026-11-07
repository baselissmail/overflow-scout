import { describe, expect, it } from 'vitest';

import type { IssueDto } from '@/messaging/protocol';

import { NO_FILTER, applyFilter } from './filter';

function issue(
  id: string,
  kind: IssueDto['kind'],
  order: number,
  text: string,
  label = 'div',
): IssueDto {
  return {
    id,
    kind,
    order,
    severity: kind === 'hidden' ? 'critical' : 'warning',
    instances: [
      {
        id: `${id}-1`,
        kind,
        severity: kind === 'hidden' ? 'critical' : 'warning',
        mechanism: 'clip',
        axes: ['x'],
        overflow: { x: 10, y: 0 },
        text,
        element: { label },
        container: { label },
        diagnosis: { confidence: 'medium', causes: [] },
        box: { width: 100, height: 20 },
      },
    ],
  };
}

const ISSUES = [
  issue('a', 'hidden', 2, 'Save changes', 'button.save'),
  issue('b', 'hidden', 0, 'Delete account'),
  issue('c', 'truncated', 1, 'Quarterly report', 'nav > a.tab'),
];

describe('results filter', () => {
  it('keeps the severity order by default and sorts by page order on request', () => {
    expect(applyFilter(ISSUES, NO_FILTER).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(applyFilter(ISSUES, { ...NO_FILTER, sort: 'page' }).map((item) => item.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('filters by kind and by text or selector, ignoring case', () => {
    const truncated = applyFilter(ISSUES, { ...NO_FILTER, kinds: new Set(['truncated'] as const) });
    expect(truncated.map((item) => item.id)).toEqual(['c']);
    expect(applyFilter(ISSUES, { ...NO_FILTER, query: ' SAVE ' }).map((item) => item.id)).toEqual([
      'a',
    ]);
    expect(applyFilter(ISSUES, { ...NO_FILTER, query: 'a.tab' }).map((item) => item.id)).toEqual([
      'c',
    ]);
  });

  it('does not change the input', () => {
    applyFilter(ISSUES, { ...NO_FILTER, sort: 'page' });
    expect(ISSUES.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});
