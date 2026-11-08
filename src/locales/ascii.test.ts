import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Everything the panel says is plain English in plain ASCII: no accented
 * letters, no other scripts, and no typographic symbols that read as noise
 * (curly quotes, dashes, ellipses, multiplication signs).
 */
describe('en.yml', () => {
  const lines = readFileSync(new URL('./en.yml', import.meta.url), 'utf8').split('\n');

  it('uses printable ASCII only', () => {
    const offending = lines
      .map((line, index) => ({ line: index + 1, text: line }))
      .filter(({ text }) => !/^[\x20-\x7e]*$/.test(text));
    expect(offending).toEqual([]);
  });
});
