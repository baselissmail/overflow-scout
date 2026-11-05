import { describe, expect, it } from 'vitest';

import { gestureMessageSchema, pageMessageSchema, pageRequestSchema } from './protocol';

describe('page requests', () => {
  it('accepts every request type', () => {
    const requests = [
      { id: 1, type: 'hello' },
      { id: 2, type: 'scan', includeInputs: true },
      {
        id: 3,
        type: 'stress',
        options: { strategy: 'pseudo', intensity: 'extreme', language: 'ar', rtl: true },
        scope: 'picked',
        includeInputs: false,
      },
      { id: 9, type: 'cancel' },
      { id: 10, type: 'selector', findingId: 'f2' },
      { id: 4, type: 'revert' },
      { id: 5, type: 'reapply' },
      { id: 6, type: 'highlight', findingId: null },
      { id: 7, type: 'reveal', findingId: 'f1' },
      { id: 8, type: 'pick', active: true },
    ];
    for (const request of requests) expect(pageRequestSchema.safeParse(request).success).toBe(true);
  });

  it('rejects unknown types, bad ids and invalid options', () => {
    const invalid = [
      { id: 1, type: 'eval', code: 'alert(1)' },
      { id: -1, type: 'scan', includeInputs: true },
      { id: 1.5, type: 'scan', includeInputs: true },
      { type: 'scan', includeInputs: true },
      { id: 1, type: 'scan' },
      {
        id: 1,
        type: 'stress',
        options: { strategy: 'shout', intensity: 'worst', language: 'de', rtl: false },
      },
      {
        id: 1,
        type: 'stress',
        options: { strategy: 'pseudo', intensity: 'worst', language: 'xx', rtl: false },
      },
      { id: 1, type: 'highlight' },
      'scan',
      null,
    ];
    for (const request of invalid) expect(pageRequestSchema.safeParse(request).success).toBe(false);
  });
});

describe('page messages', () => {
  it('accepts replies and events', () => {
    const messages = [
      { type: 'result', id: 1, result: { anything: true } },
      { type: 'error', id: 1, message: 'Nope' },
      { type: 'pending', count: 3 },
      { type: 'reverted', result: { restored: 4, keptPageChanges: 1 } },
      { type: 'pick-cancelled' },
      { type: 'progress', phase: 'stressed', textNodes: 1200 },
      { type: 'error', id: 4, message: 'The operation was aborted.', code: 'cancelled' },
    ];
    for (const message of messages) expect(pageMessageSchema.safeParse(message).success).toBe(true);
  });

  it('rejects malformed messages', () => {
    for (const message of [{ type: 'pending', count: -1 }, { type: 'result' }, { type: 'boom' }]) {
      expect(pageMessageSchema.safeParse(message).success).toBe(false);
    }
  });
});

describe('gesture messages', () => {
  it('requires a tab and a timestamp', () => {
    expect(
      gestureMessageSchema.safeParse({ type: 'gesture', tabId: 4, inspect: true, at: 1 }).success,
    ).toBe(true);
    expect(gestureMessageSchema.safeParse({ type: 'gesture', inspect: true }).success).toBe(false);
  });
});
