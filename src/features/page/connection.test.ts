import { describe, expect, it } from 'vitest';

import { classifyInjectionError } from './connection';

describe('classifyInjectionError', () => {
  it.each([
    'Cannot access a chrome:// URL',
    'Cannot access a chrome-extension:// URL of different extension',
    'The extensions gallery cannot be scripted.',
    'Cannot access contents of url "devtools://devtools/bundled/inspector.html".',
    'Cannot access contents of url "view-source:https://example.com/".',
    'Frame with ID 0 is showing error page',
  ])('treats “%s” as a restricted page', (message) => {
    expect(classifyInjectionError(message)).toEqual({ reason: 'restricted' });
  });

  it('asks for file access on local files', () => {
    expect(
      classifyInjectionError(
        'Cannot access contents of url "file:///Users/ada/index.html". Extension manifest must request permission to access this host.',
      ),
    ).toEqual({ reason: 'file-access' });
  });

  it('reports missing access, with the origin when Chrome reveals it', () => {
    expect(
      classifyInjectionError(
        'Cannot access contents of url "https://shop.example/cart?id=1". Extension manifest must request permission to access this host.',
      ),
    ).toEqual({ reason: 'no-access', origin: 'https://shop.example' });
    expect(
      classifyInjectionError(
        'Cannot access contents of the page. Extension manifest must request permission to access the respective host.',
      ),
    ).toEqual({ reason: 'no-access', origin: null });
  });

  it('passes anything else through', () => {
    expect(classifyInjectionError('No tab with id: 12.')).toEqual({
      reason: 'error',
      message: 'No tab with id: 12.',
    });
  });
});
