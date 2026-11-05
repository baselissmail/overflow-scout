import type {
  IssueDto,
  PageInfo,
  PickedElement,
  ScanResultDto,
  StressOptionsDto,
  StressResultDto,
} from '@/messaging/protocol';

import type { ConnectionFailure, PageConnection } from './connection';
import { ConnectionError } from './connection';

export type Busy = 'connect' | 'scan' | 'stress' | 'revert' | 'reapply';

export interface PanelState {
  /** The tab the panel works on: the active tab of its window. */
  tabId: number | null;
  connection: 'idle' | 'connecting' | 'ready' | 'unavailable';
  failure: ConnectionFailure | null;
  page: PageInfo | null;
  busy: Busy | null;
  error: string | null;
  scan: ScanResultDto | null;
  stress: StressResultDto | null;
  /** Which results to show: the latest scan or the latest stress test. */
  showing: 'scan' | 'stress' | null;
  /** Stress text is on the page right now. */
  stressActive: boolean;
  /** Strings the page re-rendered or added since stress was applied. */
  pending: number;
  /** The page navigated or reloaded since these results were taken. */
  stale: boolean;
  picking: boolean;
  picked: PickedElement | null;
}

export interface ControllerDeps {
  connect: (tabId: number) => Promise<{ connection: PageConnection; page: PageInfo }>;
  /** Shows the issue count on the toolbar button for a tab; null clears it. */
  setBadge: (tabId: number, issues: readonly IssueDto[] | null) => void;
}

const INITIAL: PanelState = {
  tabId: null,
  connection: 'idle',
  failure: null,
  page: null,
  busy: null,
  error: null,
  scan: null,
  stress: null,
  showing: null,
  stressActive: false,
  pending: 0,
  stale: false,
  picking: false,
  picked: null,
};

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The side panel's state machine, free of React and of extension APIs (both
 * are injected), so it can be unit-tested. One connection per target tab;
 * switching tabs closes it, which makes the page revert (plan §2.3).
 */
export class PanelController {
  private state: PanelState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private connection: PageConnection | null = null;
  private connecting: Promise<PageConnection> | null = null;

  constructor(private readonly deps: ControllerDeps) {}

  getState = (): PanelState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Points the panel at another tab. Work on the previous tab is reverted. */
  setTarget(tabId: number | null): void {
    if (tabId === this.state.tabId) return;
    this.disconnect();
    this.set({ ...INITIAL, tabId });
  }

  /** The target tab started loading a new document. */
  navigated(): void {
    this.disconnect();
    if (this.state.tabId !== null) this.deps.setBadge(this.state.tabId, null);
    this.set({
      connection: 'idle',
      failure: null,
      page: null,
      stressActive: false,
      pending: 0,
      picking: false,
      stale: this.state.scan !== null || this.state.stress !== null,
    });
  }

  /** The user granted access to a tab (toolbar button, shortcut, context menu). */
  async gesture(tabId: number, inspect: boolean): Promise<void> {
    if (tabId !== this.state.tabId) return;
    if (this.state.connection === 'unavailable') this.set({ connection: 'idle', failure: null });
    if (inspect) await this.pick(true);
  }

  async scan(): Promise<void> {
    await this.run('scan', async (connection) => {
      const scan = await connection.request('scan', {});
      this.set({ scan, showing: 'scan', stale: false, picked: null });
      this.badge(scan.issues);
    });
  }

  async stress(options: StressOptionsDto): Promise<void> {
    await this.run('stress', async (connection) => {
      const stress = await connection.request('stress', { options });
      this.set({
        stress,
        showing: 'stress',
        stressActive: true,
        pending: 0,
        stale: false,
        picked: null,
      });
      this.badge(stress.brokenNow);
    });
  }

  async revert(): Promise<void> {
    await this.run('revert', async (connection) => {
      await connection.request('revert', {});
      this.set({ stressActive: false, pending: 0 });
    });
  }

  async reapply(): Promise<void> {
    await this.run('reapply', async (connection) => {
      await connection.request('reapply', {});
      this.set({ pending: 0 });
    });
  }

  async pick(active: boolean): Promise<void> {
    await this.run(null, async (connection) => {
      await connection.request('pick', { active });
      this.set({ picking: active, ...(active && { picked: null }) });
    });
  }

  /** Highlights a finding on the page; quiet if the page isn't connected. */
  highlight(findingId: string | null): void {
    this.connection?.request('highlight', { findingId }).catch(() => undefined);
  }

  async reveal(findingId: string): Promise<void> {
    await this.run(null, (connection) => connection.request('reveal', { findingId }));
  }

  dismissError(): void {
    this.set({ error: null });
  }

  /** Closes the page connection (the page reverts). Subscribers stay, for React's StrictMode. */
  dispose(): void {
    this.disconnect();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private set(patch: Partial<PanelState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private badge(issues: readonly IssueDto[]): void {
    if (this.state.tabId !== null) this.deps.setBadge(this.state.tabId, issues);
  }

  private async run(
    busy: Busy | null,
    work: (connection: PageConnection) => Promise<unknown>,
  ): Promise<void> {
    if (busy && this.state.busy) return;
    const tabId = this.state.tabId;
    if (busy) this.set({ busy, error: null });
    try {
      const connection = await this.ensureConnection();
      await work(connection);
    } catch (error) {
      // The tab may have changed while we waited; its state is gone already.
      if (tabId === this.state.tabId && !(error instanceof ConnectionError)) {
        this.set({ error: message(error) });
      }
    } finally {
      if (busy && tabId === this.state.tabId) this.set({ busy: null });
    }
  }

  private ensureConnection(): Promise<PageConnection> {
    if (this.connection) return Promise.resolve(this.connection);
    if (this.connecting) return this.connecting;
    const { tabId } = this.state;
    if (tabId === null) return Promise.reject(new Error('No tab to work on.'));

    this.set({ connection: 'connecting', failure: null });
    const connecting = this.deps.connect(tabId).then(
      ({ connection, page }) => {
        if (this.connecting !== connecting) {
          connection.close();
          throw new Error('The tab changed.');
        }
        this.connecting = null;
        this.connection = connection;
        this.listen(connection);
        this.set({ connection: 'ready', page });
        return connection;
      },
      (error: unknown) => {
        if (this.connecting === connecting) {
          this.connecting = null;
          this.set(
            error instanceof ConnectionError
              ? { connection: 'unavailable', failure: error.failure }
              : {
                  connection: 'unavailable',
                  failure: { reason: 'error', message: message(error) },
                },
          );
        }
        throw error instanceof ConnectionError
          ? error
          : new ConnectionError({ reason: 'error', message: message(error) });
      },
    );
    this.connecting = connecting;
    return connecting;
  }

  private listen(connection: PageConnection): void {
    connection.onEvent((event) => {
      if (connection !== this.connection) return;
      switch (event.type) {
        case 'pending':
          this.set({ pending: event.count });
          break;
        case 'reverted':
          this.set({ stressActive: false, pending: 0 });
          break;
        case 'picked':
          this.set({ picking: false, picked: event.picked });
          break;
        case 'pick-cancelled':
          this.set({ picking: false });
          break;
      }
    });
    connection.onClose((expected) => {
      if (connection !== this.connection) return;
      this.connection = null;
      // Unexpected: the page navigated, reloaded, or was closed.
      if (!expected) this.navigated();
    });
  }

  private disconnect(): void {
    this.connecting = null;
    const connection = this.connection;
    this.connection = null;
    connection?.close();
  }
}
