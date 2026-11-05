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
  const controller = new PanelController({ connect, setBadge });
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

  it('closes the connection when the tab changes, so the page reverts', async () => {
    const { controller, fake } = setup({ scan: SCAN });
    await controller.scan();
    controller.setTarget(8);
    expect(fake.close).toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({ tabId: 8, scan: null, connection: 'idle' });
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
