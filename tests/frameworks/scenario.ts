import { describe, expect, it, vi } from 'vitest';

import { StressSession } from '@/core';

/**
 * Framework safety (plan §7): the same small app, written in React, Vue and
 * Svelte, keeps working while stressed and reverts to exactly what the
 * framework renders. Each test mounts two copies: one is stressed, the other
 * is a control that never is. After every step they must match.
 */

export interface InboxItem {
  id: string;
  label: string;
}

export interface InboxState {
  title: string;
  unread: number;
  items: InboxItem[];
  filtersActive: boolean;
  searchPlaceholder: string;
  sendLabel: string;
}

export interface MountedInbox {
  update: (state: InboxState) => Promise<void>;
  unmount: () => void;
}

export type MountInbox = (target: HTMLElement, state: InboxState) => Promise<MountedInbox>;

export const INITIAL_STATE: InboxState = {
  title: 'Team inbox',
  unread: 3,
  items: [
    { id: 'a', label: 'Quarterly planning notes' },
    { id: 'b', label: 'Design review feedback' },
    { id: 'c', label: 'Release checklist' },
  ],
  filtersActive: false,
  searchPlaceholder: 'Search messages',
  sendLabel: 'Send',
};

/** Re-renders that exercise every kind of DOM update: text, keyed moves, insertion, attributes. */
const WHILE_STRESSED: InboxState = {
  ...INITIAL_STATE,
  unread: 4,
  items: [
    { id: 'c', label: 'Release checklist' },
    { id: 'b', label: 'Design review feedback' },
    { id: 'a', label: 'Quarterly planning summary' },
  ],
  filtersActive: true,
  searchPlaceholder: 'Search all mail',
};

const AFTER_REVERT: InboxState = {
  ...WHILE_STRESSED,
  unread: 5,
  filtersActive: false,
  items: INITIAL_STATE.items,
};

const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

/** Collects uncaught errors and anything the framework logs with console.error. */
function collectErrors(): () => string[] {
  const errors: string[] = [];
  const onError = (event: ErrorEvent) => errors.push(event.message);
  const onRejection = (event: PromiseRejectionEvent) => errors.push(String(event.reason));
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    spy.mockRestore();
    return errors;
  };
}

const text = (root: Element, selector: string) => root.querySelector(selector)?.textContent ?? '';

export function describeFrameworkSafety(framework: string, mount: MountInbox): void {
  describe(`${framework} app under stress`, () => {
    it('keeps working while stressed and reverts to exactly what the app renders', async () => {
      const stopCollecting = collectErrors();
      const stressedRoot = document.createElement('div');
      const controlRoot = document.createElement('div');
      document.body.append(stressedRoot, controlRoot);
      const app = await mount(stressedRoot, INITIAL_STATE);
      const control = await mount(controlRoot, INITIAL_STATE);
      const update = async (state: InboxState) => {
        await app.update(state);
        await control.update(state);
        await settle();
      };

      try {
        expect(stressedRoot.innerHTML).toBe(controlRoot.innerHTML);

        const session = new StressSession(document, { scope: stressedRoot });
        const reported: number[] = [];
        const stopWatching = session.watch((pending) => reported.push(pending));
        await session.apply();
        expect(text(stressedRoot, 'h1').startsWith('Team inbox ')).toBe(true);
        expect(text(stressedRoot, '[data-id="b"]').startsWith('Design review feedback ')).toBe(
          true,
        );

        // The app re-renders while stressed.
        await update(WHILE_STRESSED);
        const order = Array.from(stressedRoot.querySelectorAll('li'), (li) => li.dataset['id']);
        expect(order).toEqual(['c', 'b', 'a']);
        // Text the app changed shows the app's value; moved nodes keep their stress text.
        expect(text(stressedRoot, '[data-id="a"]')).toBe('Quarterly planning summary');
        expect(text(stressedRoot, '[data-id="b"]').startsWith('Design review feedback ')).toBe(
          true,
        );
        expect(text(stressedRoot, '.filters')).toBe('Filters are active');
        expect(stressedRoot.querySelector('.search')?.getAttribute('placeholder')).toBe(
          'Search all mail',
        );
        expect(session.pending()).toBeGreaterThanOrEqual(3);
        expect(reported.at(-1)).toBe(session.pending());

        // Re-apply covers what the app re-rendered or added.
        await session.apply();
        expect(session.pending()).toBe(0);
        expect(text(stressedRoot, '.filters').startsWith('Filters are active ')).toBe(true);

        // Revert leaves exactly what the app renders for its current state.
        session.revert();
        stopWatching();
        expect(stressedRoot.innerHTML).toBe(controlRoot.innerHTML);

        // And the app keeps working afterwards.
        await update(AFTER_REVERT);
        expect(stressedRoot.innerHTML).toBe(controlRoot.innerHTML);
        expect(stressedRoot.querySelector('.filters')).toBeNull();
      } finally {
        app.unmount();
        control.unmount();
        stressedRoot.remove();
        controlRoot.remove();
        expect(stopCollecting()).toEqual([]);
      }
    });
  });
}
