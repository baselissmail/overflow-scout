import { afterAll, describe, expect, it } from 'vitest';

import type { PageMessage, PageRequest } from '@/messaging/protocol';
import { PageSession } from '@/runtime/session';

import { loadFixture } from '../engine/harness';

const page = `<!doctype html><html><head><style>
  body { margin: 16px; font: 16px/20px sans-serif; }
  .clip { width: 120px; overflow: hidden; white-space: nowrap; }
  .card { width: 200px; height: 20px; overflow: hidden; }
</style></head><body>
  <button class="clip" id="b">Save</button>
  <p class="card" id="c">Waterproof hiking jacket with a detachable hood</p>
</body></html>`;

function harness(doc: Document) {
  const messages: PageMessage[] = [];
  const session = new PageSession(doc, (message) => messages.push(message), {
    text: { stressActive: 'Stress test active', revert: 'Revert' },
  });
  let id = 0;
  const request = async <T>(body: Record<string, unknown>): Promise<T> => {
    id += 1;
    await session.handle({ id, ...body } as PageRequest);
    const reply = messages.findLast((message) => 'id' in message && message.id === id);
    if (reply?.type !== 'result') throw new Error(JSON.stringify(reply));
    return reply.result as T;
  };
  return { session, messages, request };
}

/** Plan Phase 6, memory: a closed session leaves no listeners, observers or edits behind. */
describe('PageSession.dispose', () => {
  it('leaves the page exactly as it was, and stops listening', async () => {
    const { doc, dispose } = await loadFixture(page);
    try {
      const before = doc.documentElement.outerHTML;
      const { session, messages, request } = harness(doc);
      const scan = await request<{ issues: { instances: { id: string }[] }[] }>({
        type: 'scan',
        includeInputs: true,
      });
      const findingId = scan.issues[0]?.instances[0]?.id ?? '';
      await request({ type: 'highlight', findingId });
      // Longer text, a fix preview and a highlight on the page at the same time.
      const stressed = await request<{ brokenNow: { instances: { id: string }[] }[] }>({
        type: 'stress',
        options: { strategy: 'translation', intensity: 'worst', language: 'de', rtl: false },
        scope: 'page',
        includeInputs: true,
      });
      const broken = stressed.brokenNow[0]?.instances[0]?.id ?? '';
      expect(broken).not.toBe('');
      await request({ type: 'preview', findingId: broken, key: 'all' });
      expect(doc.getElementById('c')?.hasAttribute('style')).toBe(true);
      expect(doc.querySelector('overflow-scout-root')).not.toBeNull();

      session.dispose();
      expect(doc.querySelector('overflow-scout-root')).toBeNull();
      expect(doc.documentElement.outerHTML).toBe(before);

      // Nothing is listening any more: page changes and scrolling send nothing.
      const sent = messages.length;
      doc.getElementById('c')?.append(' and more text the app rendered');
      doc.defaultView?.dispatchEvent(new Event('scroll'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(messages.length).toBe(sent);
    } finally {
      dispose();
    }
  });
});

afterAll(() => {
  document.body.replaceChildren();
});
