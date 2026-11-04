import { describe, expect, it } from 'vitest';

import { elementSignature, isGeneratedName, stableClasses } from './fingerprint';

describe('isGeneratedName', () => {
  it.each([
    'css-1x2y3z',
    'sc-bdVaJa',
    'jsx-2145553711',
    'svelte-1k2j3h4',
    'ng-tns-c12-3',
    'Button_primary__3xYz1',
    '_title_1x2y3',
    'a8f3k29d',
  ])('flags %s as generated', (name) => {
    expect(isGeneratedName(name)).toBe(true);
  });

  it.each(['nav-link', 'btn-primary', 'card', 'text-sm', 'md:grid-cols-2', 'h1', 'col-12'])(
    'keeps %s as authored',
    (name) => {
      expect(isGeneratedName(name)).toBe(false);
    },
  );
});

describe('stableClasses', () => {
  it('drops generated and state classes, dedupes and sorts', () => {
    expect(
      stableClasses(['tab', 'is-active', 'css-1x2y3z', 'active', 'tab', 'tab--large', '']),
    ).toEqual(['tab', 'tab--large']);
  });
});

describe('elementSignature', () => {
  it('combines tag, role and stable classes', () => {
    expect(
      elementSignature({
        tag: 'a',
        role: 'tab',
        classNames: ['nav-link', 'selected', 'css-9q8w7e'],
      }),
    ).toBe('a[role=tab].nav-link');
  });

  it('is the same for instances of one component in different states', () => {
    const base = { tag: 'li', role: null };
    expect(elementSignature({ ...base, classNames: ['item', 'is-open'] })).toBe(
      elementSignature({ ...base, classNames: ['item'] }),
    );
  });
});
