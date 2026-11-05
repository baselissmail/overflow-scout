import { describe, expect, it } from 'vitest';

import { isNewPage } from './navigation';

describe('isNewPage', () => {
  const page = 'https://app.example/inbox?folder=1#top';

  it('counts route changes, pushed queries and hash routes', () => {
    expect(isNewPage(page, 'https://app.example/settings', 'push')).toBe(true);
    expect(isNewPage(page, 'https://app.example/inbox?folder=2', 'push')).toBe(true);
    expect(isNewPage(page, 'https://app.example/settings', 'replace')).toBe(true);
    expect(isNewPage(page, page, 'reload')).toBe(true);
    expect(isNewPage('https://app.example/#/inbox', 'https://app.example/#/settings', 'push')).toBe(
      true,
    );
    expect(
      isNewPage('https://app.example/#!/inbox', 'https://app.example/#!/sent', 'traverse'),
    ).toBe(true);
  });

  it('ignores anchors and queries kept in sync with replaceState', () => {
    expect(isNewPage(page, 'https://app.example/inbox?folder=1#message-3', 'push')).toBe(false);
    expect(isNewPage(page, 'https://app.example/inbox?folder=1&q=invoice#top', 'replace')).toBe(
      false,
    );
    expect(isNewPage(page, page, 'replace')).toBe(false);
  });
});
