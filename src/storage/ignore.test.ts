import { describe, expect, it } from 'vitest';

import type { IgnoreRule } from './ignore';
import { normalizeRules, siteOf, withRule, withoutRule } from './ignore';

const rule = (overrides: Partial<IgnoreRule> = {}): IgnoreRule => ({
  site: 'https://shop.example',
  issueId: 'truncated|a.tab|nav.tabs',
  kind: 'truncated',
  label: 'nav > a.tab',
  at: 1,
  ...overrides,
});

describe('ignore rules', () => {
  it('belong to a site: the origin, or file:// for local files', () => {
    expect(siteOf('https://shop.example/products?id=1')).toBe('https://shop.example');
    expect(siteOf('http://localhost:5173/')).toBe('http://localhost:5173');
    expect(siteOf('file:///Users/me/page.html')).toBe('file://');
    expect(siteOf('chrome-extension://abc/demo.html')).toBe('chrome-extension://abc');
    expect(siteOf('chrome://extensions')).toBeNull();
    expect(siteOf('not a url')).toBeNull();
  });

  it('drop corrupt and duplicate entries from storage', () => {
    expect(normalizeRules('x')).toEqual([]);
    expect(
      normalizeRules([
        rule(),
        { site: 1 },
        rule({ at: 2 }),
        { ...rule({ issueId: 'other' }), kind: 'shout' },
      ]),
    ).toEqual([rule()]);
  });

  it('are added once and removed per site', () => {
    const rules = withRule(withRule([], rule()), rule({ at: 5 }));
    expect(rules).toEqual([rule()]);
    const other = withRule(rules, rule({ site: 'https://blog.example' }));
    expect(withoutRule(other, 'https://shop.example', rule().issueId)).toEqual([
      rule({ site: 'https://blog.example' }),
    ]);
  });
});
