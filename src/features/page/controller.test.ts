import { describe, expect, it, vi } from 'vitest';

import type { PageMessage, PageRequestType, ScanResultDto } from '@/messaging/protocol';

import type { PageConnection } from './connection';
import { ConnectionError } from './connection';
import { PanelController } from './controller';

const SCAN: ScanResultDto = {
  issues: [
    {
      id: 'hidden|div|body',
      order: 0,
      kind: 'hidden',
      severity: 'critical',
      instances: [
        {
          id: 'f1',
          kind: 'hidden',
          severity: 'critical',
          mechanism: 'clip',
          axes: ['x'],
          overflow: { x: 40, y: 0 },
          text: 'Save changes',
          element: { label: 'div', selector: 'div' },
          container: { label: 'div' },
          diagnosis: { confidence: 'high', causes: [] },
          box: { width: 120, height: 20 },
        },
      ],
    },
  ],
  stats: {
    textNodes: 3,
    inputs: 0,
    skippedInvisible: 0,
    skippedForeign: 0,
    shadowRoots: 0,
    framesSkipped: 0,
    durationMs: 1,
    wallMs: 1,
    slices: 1,
    longestSliceMs: 1,
  },
  viewport: { width: 1024, height: 768 },
};

type Event = Exclude<PageMessage, { type: 'result' | 'error' }>;

/** A stand-in for the port-based connection, driven by the test. */
function fakeConnection(results: Partial<Record<PageRequestType, unknown>> = {}) {
  const events = new Set<(event: Event) => void>();
  const closes = new Set<(expected: boolean) => void>();
  const connection = {
    request: vi.fn((type: PageRequestType) => Promise.resolve(results[type] ?? null)),
    onEvent: (listener: (event: Event) => void) => {
      events.add(listener);
      return () => events.delete(listener);
    },
    onClose: (listener: (expected: boolean) => void) => {
      closes.add(listener);
      return () => closes.delete(listener);
    },
    close: vi.fn(() => {
      for (const listener of closes) listener(true);
    }),
  };
  return {
    connection: connection as unknown as PageConnection,
    request: connection.request,
    close: connection.close,
    emit: (event: Event) => {
      for (const listener of events) listener(event);
    },
    drop: () => {
      for (const listener of closes) listener(false);
    },
  };
}

const PAGE = {
  url: 'https://shop.example/',
  title: 'Shop',
  viewport: { width: 1024, height: 768 },
};

function setup(results?: Partial<Record<PageRequestType, unknown>>) {
  const fake = fakeConnection(results);
  const connect = vi.fn(() => Promise.resolve({ connection: fake.connection, page: PAGE }));
  const setBadge = vi.fn();
  const capture = vi.fn(() => Promise.resolve('data:image/png;base64,'));
  const controller = new PanelController({ connect, setBadge, capture });
  controller.setTarget(7);
  return { controller, fake, request: fake.request, connect, setBadge };
}

describe('PanelController', () => {
  it('connects on first use, scans, and badges the tab', async () => {
    const { controller, connect, setBadge } = setup({ scan: SCAN });
    const busyStates: (string | null)[] = [];
    controller.subscribe(() => busyStates.push(controller.getState().busy));

    await controller.scan();

    expect(connect).toHaveBeenCalledWith(7);
    expect(controller.getState()).toMatchObject({
      connection: 'ready',
      page: PAGE,
      scan: SCAN,
      showing: 'scan',
      busy: null,
    });
    expect(busyStates).toContain('scan');
    expect(setBadge).toHaveBeenCalledWith(7, SCAN.issues);
  });

  it('reuses the connection', async () => {
    const { controller, connect } = setup({ scan: SCAN });
    await controller.scan();
    await controller.scan();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('explains why a page is unavailable', async () => {
    const setBadge = vi.fn();
    const controller = new PanelController({
      connect: () => Promise.reject(new ConnectionError({ reason: 'restricted' })),
      setBadge,
      capture: () => Promise.reject(new Error('restricted')),
    });
    controller.setTarget(3);
    await controller.scan();
    expect(controller.getState()).toMatchObject({
      connection: 'unavailable',
      failure: { reason: 'restricted' },
      error: null,
      busy: null,
    });
  });

  describe('with more than one tab', () => {
    const STRESS = { brokenNow: [], atRisk: SCAN.issues, stats: {} };
    const OPTIONS = {
      strategy: 'translation',
      intensity: 'worst',
      language: 'de',
      rtl: false,
    } as const;

    /** A connection per tab, so each tab's page can be told apart. */
    function tabs() {
      const fakes = new Map<number, ReturnType<typeof fakeConnection>>();
      const fakeFor = (tabId: number) => {
        let fake = fakes.get(tabId);
        if (!fake) {
          fake = fakeConnection({ scan: SCAN, stress: STRESS });
          fakes.set(tabId, fake);
        }
        return fake;
      };
      const connect = vi.fn((tabId: number) =>
        Promise.resolve({ connection: fakeFor(tabId).connection, page: PAGE }),
      );
      const setBadge = vi.fn();
      const controller = new PanelController({
        connect,
        setBadge,
        capture: () => Promise.resolve('data:image/png;base64,'),
      });
      controller.setTarget(7);
      return { controller, fakeFor, connect, setBadge };
    }

    it('keeps a tab as it was left, longer text and all, until the panel closes', async () => {
      const { controller, fakeFor, connect } = tabs();
      await controller.stress(OPTIONS);
      const seven = fakeFor(7);

      controller.setTarget(8);
      expect(controller.getState()).toMatchObject({ tabId: 8, stress: null, connection: 'idle' });
      expect(seven.close).not.toHaveBeenCalled();
      // Nobody is looking: tried text, a previewed fix and the outline go away.
      expect(seven.request).toHaveBeenCalledWith('tryText', { value: null });
      expect(seven.request).toHaveBeenCalledWith('preview', { findingId: '', key: null });
      expect(seven.request).toHaveBeenCalledWith('highlight', { findingId: null });

      // The page left behind still talks to its tab's state.
      seven.emit({ type: 'pending', count: 2 });
      expect(controller.getState().pending).toBe(0);

      controller.setTarget(7);
      expect(controller.getState()).toMatchObject({
        tabId: 7,
        connection: 'ready',
        stress: STRESS,
        showing: 'stress',
        stressActive: true,
        pending: 2,
      });
      await controller.scan();
      expect(connect.mock.calls.filter(([tab]) => tab === 7)).toHaveLength(1);

      controller.setTarget(8);
      await controller.scan();
      controller.dispose();
      expect(seven.close).toHaveBeenCalled();
      expect(fakeFor(8).close).toHaveBeenCalled();
    });

    it('lands work that ends after a tab switch on its own tab', async () => {
      const { controller, fakeFor } = tabs();
      const seven = fakeFor(7);
      let finish: (scan: ScanResultDto) => void = () => undefined;
      seven.request.mockImplementation((type: PageRequestType) =>
        type === 'scan'
          ? new Promise((resolve) => {
              finish = resolve;
            })
          : Promise.resolve(null),
      );
      const scanning = controller.scan();
      await vi.waitFor(() => {
        expect(seven.request).toHaveBeenCalledWith('scan', { includeInputs: true });
      });
      controller.setTarget(8);
      finish(SCAN);
      await scanning;
      expect(controller.getState()).toMatchObject({ tabId: 8, scan: null, busy: null });
      controller.setTarget(7);
      expect(controller.getState()).toMatchObject({ scan: SCAN, busy: null });
    });

    it('marks a tab left behind stale when it navigates, and lets go of closed tabs', async () => {
      const { controller, fakeFor, setBadge } = tabs();
      await controller.scan();
      controller.setTarget(8);
      fakeFor(7).drop();
      expect(setBadge).toHaveBeenLastCalledWith(7, null);
      controller.setTarget(7);
      expect(controller.getState()).toMatchObject({ scan: SCAN, stale: true });

      await controller.scan();
      controller.setTarget(8);
      controller.tabClosed(7);
      expect(fakeFor(7).close).toHaveBeenCalled();
      controller.setTarget(7);
      expect(controller.getState()).toMatchObject({ scan: null, connection: 'idle' });

      // The tab on screen closing leaves the panel without one.
      controller.tabClosed(7);
      expect(controller.getState().tabId).toBeNull();
    });
  });

  it('marks results stale when the page goes away', async () => {
    const { controller, fake, setBadge } = setup({ scan: SCAN });
    await controller.scan();
    fake.drop();
    expect(controller.getState()).toMatchObject({ stale: true, connection: 'idle', scan: SCAN });
    expect(setBadge).toHaveBeenLastCalledWith(7, null);

    await controller.scan();
    expect(controller.getState().stale).toBe(false);
  });

  it('starts over when a tab with no connection loads, and ignores loads it is connected to', async () => {
    const setBadge = vi.fn();
    const controller = new PanelController({
      connect: () => Promise.reject(new ConnectionError({ reason: 'restricted' })),
      setBadge,
      capture: () => Promise.reject(new Error('restricted')),
    });
    controller.setTarget(3);
    await controller.scan();
    expect(controller.getState().connection).toBe('unavailable');
    controller.tabLoading();
    expect(controller.getState()).toMatchObject({ connection: 'idle', failure: null });

    // Connected: the port closing or the page's own event decides instead.
    const { controller: connected, fake } = setup({ scan: SCAN });
    await connected.scan();
    connected.tabLoading();
    expect(fake.close).not.toHaveBeenCalled();
    expect(connected.getState()).toMatchObject({ connection: 'ready', stale: false });
  });

  it('ends work a route change interrupts quietly, as stale results', async () => {
    const { controller, fake } = setup();
    let fail: (error: Error) => void = () => undefined;
    fake.request.mockImplementation((type: PageRequestType) =>
      type === 'scan'
        ? new Promise((_, reject) => {
            fail = reject;
          })
        : Promise.resolve(null),
    );
    const scanning = controller.scan();
    await vi.waitFor(() => {
      expect(fake.request).toHaveBeenCalledWith('scan', { includeInputs: true });
    });
    // The single-page app changes route mid-scan; the port closes under the request.
    fake.emit({ type: 'navigated' });
    fail(new Error('The page went away.'));
    await scanning;
    expect(controller.getState()).toMatchObject({ error: null, busy: null, connection: 'idle' });
  });

  it('tracks stress state from page events', async () => {
    const { controller, fake } = setup({
      stress: { brokenNow: [], atRisk: SCAN.issues, stats: {} },
    });
    await controller.stress({
      strategy: 'translation',
      intensity: 'worst',
      language: 'de',
      rtl: false,
    });
    expect(controller.getState()).toMatchObject({ stressActive: true, showing: 'stress' });

    fake.emit({ type: 'pending', count: 2 });
    expect(controller.getState().pending).toBe(2);
    fake.emit({ type: 'reverted', result: { restored: 3, keptPageChanges: 0 } });
    expect(controller.getState()).toMatchObject({ stressActive: false, pending: 0 });
  });

  it('checks the page again once the text is back to normal', async () => {
    const { controller, fake, request } = setup({
      stress: { brokenNow: [], atRisk: SCAN.issues, stats: {} },
      revert: { restored: 3, keptPageChanges: 0 },
      scan: SCAN,
    });
    const options = {
      strategy: 'translation',
      intensity: 'realistic',
      language: 'de',
      rtl: false,
    } as const;
    await controller.stress(options, 'page', false);
    await controller.revert();
    expect(controller.getState()).toMatchObject({ stressActive: false, showing: 'scan' });
    expect(request).toHaveBeenLastCalledWith('scan', { includeInputs: false });

    // The same when the button on the page puts the text back.
    await controller.stress(options);
    fake.emit({ type: 'reverted', result: { restored: 3, keptPageChanges: 0 } });
    await vi.waitFor(() => {
      expect(controller.getState().showing).toBe('scan');
    });
  });

  it('runs the picker and receives the picked element', async () => {
    const { controller, fake, request } = setup();
    await controller.pick(true);
    expect(request).toHaveBeenCalledWith('pick', { active: true });
    expect(controller.getState().picking).toBe(true);

    const picked = {
      element: { label: 'button.buy' },
      size: { width: 112, height: 40 },
      text: 'Add to cart',
      breakingPoint: null,
    };
    fake.emit({ type: 'picked', picked });
    expect(controller.getState()).toMatchObject({ picking: false, picked });
  });

  it('opens the panel’s picker from a context-menu gesture on its tab only', async () => {
    const { controller, request } = setup();
    await controller.gesture(99, true);
    expect(request).not.toHaveBeenCalled();
    await controller.gesture(7, true);
    expect(request).toHaveBeenCalledWith('pick', { active: true });
  });

  it('reports request errors without losing the connection', async () => {
    const { controller, request } = setup();
    request.mockRejectedValueOnce(new Error('This result is from an earlier scan. Scan again.'));
    await controller.reveal('f9');
    expect(controller.getState()).toMatchObject({
      connection: 'ready',
      error: 'This result is from an earlier scan. Scan again.',
    });
    controller.dismissError();
    expect(controller.getState().error).toBeNull();
  });
});
