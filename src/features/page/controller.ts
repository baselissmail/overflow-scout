import type {
  IssueDto,
  PageInfo,
  PickedElement,
  PreviewKey,
  TextTrialDto,
  TextValueDto,
  ProgressPhase,
  ResultOf,
  ScanResultDto,
  StressOptionsDto,
  StressResultDto,
} from '@/messaging/protocol';

import { cropImage } from '@/features/report/screenshot';

import type { ConnectionFailure, PageConnection } from './connection';
import { ConnectionError, RequestError } from './connection';

export type Busy = 'connect' | 'scan' | 'stress' | 'revert' | 'reapply';

export interface PanelState {
  /** The tab the panel works on: the active tab of its window. */
  tabId: number | null;
  connection: 'idle' | 'connecting' | 'ready' | 'unavailable';
  failure: ConnectionFailure | null;
  page: PageInfo | null;
  busy: Busy | null;
  /** Live progress of the scan or stress test in progress. */
  progress: { phase: ProgressPhase; textNodes: number } | null;
  error: string | null;
  scan: ScanResultDto | null;
  stress: StressResultDto | null;
  /** The options the latest stress test ran with, so its results can say so. */
  stressOptions: StressOptionsDto | null;
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
  /** The latest revert, from the panel or the page's own button, so the panel can confirm it. */
  restored: { texts: number; seq: number } | null;
}

/** Chrome refused to capture the tab: the toolbar button wasn't clicked since it loaded. */
export class CaptureNotAllowed extends Error {
  override name = 'CaptureNotAllowed';
}

/** The panel's tab isn't the one in front, so a capture would show another page. */
export class CaptureHidden extends Error {
  override name = 'CaptureHidden';
}

export interface ControllerDeps {
  connect: (tabId: number) => Promise<{ connection: PageConnection; page: PageInfo }>;
  /** Shows the issue count on the toolbar button for a tab; null clears it. */
  setBadge: (tabId: number, issues: readonly IssueDto[] | null) => void;
  /** A PNG data URL of what the tab shows (`tabs.captureVisibleTab`). */
  capture: (tabId: number) => Promise<string>;
}

const INITIAL: PanelState = {
  tabId: null,
  connection: 'idle',
  failure: null,
  page: null,
  busy: null,
  progress: null,
  error: null,
  scan: null,
  stress: null,
  stressOptions: null,
  showing: null,
  stressActive: false,
  pending: 0,
  stale: false,
  picking: false,
  picked: null,
  restored: null,
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

  /** Counts navigations, so work they interrupted ends quietly instead of as an error. */
  private navigations = 0;
  /** The issues the badge counts, so it can be redone when ignore rules change. */
  private badged: readonly IssueDto[] | null = null;
  private ignored: ReadonlySet<string> = new Set();

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

  /**
   * The page the results describe is gone: a new document loaded (the port
   * closed) or a single-page app changed route (the page said so). Ending the
   * connection makes the page put stress text back and remove its overlay,
   * whether or not its script is still there.
   */
  navigated(): void {
    this.navigations += 1;
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

  async scan(includeInputs = true): Promise<void> {
    await this.run('scan', async (connection) => {
      const scan = await connection.request('scan', { includeInputs });
      this.set({ scan, showing: 'scan', stale: false, picked: null });
      this.badge(scan.issues);
    });
  }

  async stress(
    options: StressOptionsDto,
    scope: 'page' | 'picked' = 'page',
    includeInputs = true,
  ): Promise<void> {
    await this.run('stress', async (connection) => {
      const stress = await connection.request('stress', { options, scope, includeInputs });
      this.set({
        stress,
        stressOptions: options,
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
      const result = await connection.request('revert', {});
      this.set({ stressActive: false, pending: 0, restored: this.nextRestored(result.restored) });
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

  /** Stops the scan or stress test in progress. */
  cancel(): void {
    this.connection?.request('cancel', {}).catch(() => undefined);
  }

  /** The selector and cut of a finding; only the first place of an issue arrives with them. */
  async details(findingId: string): Promise<ResultOf<'details'>> {
    try {
      const connection = await this.ensureConnection();
      return await connection.request('details', { findingId });
    } catch {
      return null;
    }
  }

  /** Tries each suggested fix on the page and reports what it does; null if that can't run. */
  async fixes(findingId: string): Promise<ResultOf<'fixes'>> {
    try {
      const connection = await this.ensureConnection();
      return await connection.request('fixes', { findingId });
    } catch {
      return null;
    }
  }

  /**
   * Keeps a fix (or all of them) applied on the page so it can be seen; `null`
   * stops it. Resolves false when the page couldn't apply it.
   */
  async preview(findingId: string, key: PreviewKey | null): Promise<boolean> {
    try {
      const connection = await this.ensureConnection();
      await connection.request('preview', { findingId, key });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * A PNG of a finding on the page, cropped to it with its outline. Rejects
   * with the reason when the tab can't be captured.
   */
  async screenshot(findingId: string): Promise<Blob> {
    const { tabId } = this.state;
    if (tabId === null) throw new Error('No tab to work on.');
    const connection = await this.ensureConnection();
    const frame = await connection.request('frame', { findingId });
    if (!frame) throw new Error('This result is from an earlier scan. Scan again.');
    let image: string;
    try {
      image = await this.deps.capture(tabId);
    } catch (error) {
      // Chrome allows captures only with activeTab (a click on the toolbar button) or <all_urls>.
      const message = error instanceof Error ? error.message : String(error);
      throw /activeTab|all_urls/.test(message) ? new CaptureNotAllowed(message) : error;
    }
    return cropImage(image, frame.rect, frame.viewport);
  }

  /** Highlights a finding on the page; quiet if the page isn't connected. */
  highlight(findingId: string | null): void {
    this.connection?.request('highlight', { findingId }).catch(() => undefined);
  }

  async reveal(findingId: string): Promise<void> {
    await this.run(null, (connection) => connection.request('reveal', { findingId }));
  }

  /**
   * The tab started loading. With a connection open, the port closing (or the
   * page's own `navigated`) handles it; without one, nothing else will: a
   * restricted-page notice or a half-finished connect would stay on screen.
   */
  tabLoading(): void {
    if (!this.connection) this.navigated();
  }

  /** Closes the inspect card, puts any tried text back, and clears its outline. */
  closeInspect(): void {
    this.set({ picked: null });
    this.connection?.request('tryText', { value: null }).catch(() => undefined);
    this.highlight(null);
  }

  /**
   * Puts a text in the picked element and measures it; `null` puts the
   * element's own text back. Null when the page can't be reached.
   */
  async tryText(value: TextValueDto | null, findingId?: string): Promise<TextTrialDto | null> {
    try {
      const connection = await this.ensureConnection();
      return await connection.request('tryText', {
        value,
        ...(findingId !== undefined && { findingId }),
      });
    } catch {
      return null;
    }
  }

  /** The whole text of a result's element, or of the picked one, to start editing from. */
  async textOf(findingId?: string): Promise<string | null> {
    try {
      const connection = await this.ensureConnection();
      return await connection.request('textOf', findingId === undefined ? {} : { findingId });
    } catch {
      return null;
    }
  }

  /** Back to the start screen. Stress text, if any, stays until reverted. */
  clearResults(): void {
    this.set({ scan: null, stress: null, showing: null, stale: false, picked: null });
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

  private nextRestored(texts: number): PanelState['restored'] {
    return { texts, seq: (this.state.restored?.seq ?? 0) + 1 };
  }

  private badge(issues: readonly IssueDto[]): void {
    this.badged = issues;
    if (this.state.tabId === null) return;
    this.deps.setBadge(
      this.state.tabId,
      issues.filter((issue) => !this.ignored.has(issue.id)),
    );
  }

  /**
   * Issues ignored on the current site (by fingerprint). The toolbar badge
   * leaves them out; the panel decides whether to show them.
   */
  setIgnored(ids: ReadonlySet<string>): void {
    if (ids.size === this.ignored.size && [...ids].every((id) => this.ignored.has(id))) return;
    this.ignored = ids;
    if (this.badged) this.badge(this.badged);
  }

  private async run(
    busy: Busy | null,
    work: (connection: PageConnection) => Promise<unknown>,
  ): Promise<void> {
    if (busy && this.state.busy) return;
    const tabId = this.state.tabId;
    const navigations = this.navigations;
    if (busy) this.set({ busy, error: null });
    try {
      const connection = await this.ensureConnection();
      await work(connection);
    } catch (error) {
      // The tab may have changed or navigated while we waited; the stale notice says so.
      const cancelled = error instanceof RequestError && error.code === 'cancelled';
      const moved = tabId !== this.state.tabId || navigations !== this.navigations;
      if (!moved && !cancelled && !(error instanceof ConnectionError)) {
        this.set({ error: message(error) });
      }
    } finally {
      if (busy && tabId === this.state.tabId) this.set({ busy: null, progress: null });
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
        case 'progress':
          if (this.state.busy)
            this.set({ progress: { phase: event.phase, textNodes: event.textNodes } });
          break;
        case 'pending':
          this.set({ pending: event.count });
          break;
        case 'reverted':
          this.set({
            stressActive: false,
            pending: 0,
            restored: this.nextRestored(event.result.restored),
          });
          break;
        case 'picked':
          this.set({ picking: false, picked: event.picked });
          break;
        case 'pick-cancelled':
          this.set({ picking: false });
          break;
        case 'navigated':
          this.navigated();
          break;
      }
    });
    connection.onClose((expected) => {
      if (connection !== this.connection) return;
      this.connection = null;
      // Unexpected: a new document loaded, or the tab closed or went into the back/forward cache.
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
