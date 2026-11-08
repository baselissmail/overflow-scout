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

/** One tab's work: what the panel shows for it, and its page connection while one is open. */
interface Session {
  state: PanelState;
  connection: PageConnection | null;
  connecting: Promise<PageConnection> | null;
  /** Counts navigations, so work they interrupted ends quietly instead of as an error. */
  navigations: number;
  /** The issues the badge counts, so it can be redone when ignore rules change. */
  badged: readonly IssueDto[] | null;
  /** Whether the latest check included fields, so a check after a revert matches it. */
  includeInputs: boolean;
}

const newSession = (tabId: number | null): Session => ({
  state: { ...INITIAL, tabId },
  connection: null,
  connecting: null,
  navigations: 0,
  badged: null,
  includeInputs: true,
});

/**
 * The side panel's state machine, free of React and of extension APIs (both
 * are injected), so it can be unit-tested. One connection per tab. Switching
 * tabs keeps the tab left behind as it was (its results, and longer text on
 * its page), so coming back to it picks up where it was left. Closing the
 * panel closes every connection, which makes every page revert (plan §2.3).
 */
export class PanelController {
  /** The tab the panel shows. */
  private session: Session = newSession(null);
  /** Tabs the panel worked on and then left, by tab id. */
  private readonly away = new Map<number, Session>();
  private readonly listeners = new Set<() => void>();
  private ignored: ReadonlySet<string> = new Set();
  private restoredSeq = 0;

  constructor(private readonly deps: ControllerDeps) {}

  getState = (): PanelState => this.session.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Points the panel at another tab. The tab it leaves keeps its work, to come back to. */
  setTarget(tabId: number | null): void {
    if (tabId === this.session.state.tabId) return;
    this.leave(this.session);
    const back = tabId === null ? undefined : this.away.get(tabId);
    if (tabId !== null) this.away.delete(tabId);
    this.session = back ?? newSession(tabId);
    this.notify();
  }

  /** A tab closed: its work ends, and the panel lets go of it if it was showing it. */
  tabClosed(tabId: number): void {
    const left = this.away.get(tabId);
    if (left) {
      this.away.delete(tabId);
      this.close(left);
    }
    if (tabId === this.session.state.tabId) {
      this.close(this.session);
      this.session = newSession(null);
      this.notify();
    }
  }

  /**
   * The page the results describe is gone: a new document loaded (the port
   * closed) or a single-page app changed route (the page said so). Ending the
   * connection makes the page put stress text back and remove its overlay,
   * whether or not its script is still there.
   */
  navigated(): void {
    this.pageGone(this.session);
  }

  /** The user granted access to a tab (toolbar button, shortcut, context menu). */
  async gesture(tabId: number, inspect: boolean): Promise<void> {
    if (tabId !== this.session.state.tabId) return;
    if (this.session.state.connection === 'unavailable') {
      this.set({ connection: 'idle', failure: null });
    }
    if (inspect) await this.pick(true);
  }

  async scan(includeInputs = true): Promise<void> {
    await this.scanIn(this.session, includeInputs);
  }

  async stress(
    options: StressOptionsDto,
    scope: 'page' | 'picked' = 'page',
    includeInputs = true,
  ): Promise<void> {
    const session = this.session;
    session.includeInputs = includeInputs;
    await this.run(session, 'stress', async (connection) => {
      const stress = await connection.request('stress', { options, scope, includeInputs });
      this.update(session, {
        stress,
        stressOptions: options,
        showing: 'stress',
        stressActive: true,
        pending: 0,
        stale: false,
        picked: null,
      });
      this.badge(session, stress.brokenNow);
    });
  }

  async revert(): Promise<void> {
    const session = this.session;
    await this.run(session, 'revert', async (connection) => {
      const result = await connection.request('revert', {});
      this.update(session, {
        stressActive: false,
        pending: 0,
        restored: this.nextRestored(result.restored),
      });
    });
    await this.checkAfterRevert(session);
  }

  async reapply(): Promise<void> {
    const session = this.session;
    await this.run(session, 'reapply', async (connection) => {
      await connection.request('reapply', {});
      this.update(session, { pending: 0 });
    });
  }

  async pick(active: boolean): Promise<void> {
    const session = this.session;
    await this.run(session, null, async (connection) => {
      await connection.request('pick', { active });
      this.update(session, { picking: active, ...(active && { picked: null }) });
    });
  }

  /** Stops the scan or stress test in progress. */
  cancel(): void {
    this.session.connection?.request('cancel', {}).catch(() => undefined);
  }

  /** The selector and cut of a finding; only the first place of an issue arrives with them. */
  async details(findingId: string): Promise<ResultOf<'details'>> {
    try {
      const connection = await this.ensureConnection(this.session);
      return await connection.request('details', { findingId });
    } catch {
      return null;
    }
  }

  /** Tries each suggested fix on the page and reports what it does; null if that can't run. */
  async fixes(findingId: string): Promise<ResultOf<'fixes'>> {
    try {
      const connection = await this.ensureConnection(this.session);
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
    // Nothing is previewed on a page the panel isn't connected to.
    if (key === null && !this.session.connection) return true;
    try {
      const connection = await this.ensureConnection(this.session);
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
    const { tabId } = this.session.state;
    if (tabId === null) throw new Error('No tab to work on.');
    const connection = await this.ensureConnection(this.session);
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
    this.session.connection?.request('highlight', { findingId }).catch(() => undefined);
  }

  async reveal(findingId: string): Promise<void> {
    await this.run(this.session, null, (connection) => connection.request('reveal', { findingId }));
  }

  /**
   * A tab started loading. With a connection open, the port closing (or the
   * page's own `navigated`) handles it; without one, nothing else will: a
   * restricted-page notice or a half-finished connect would stay on screen,
   * and results kept for a tab left behind would look current.
   */
  tabLoading(tabId: number | null = this.session.state.tabId): void {
    const session =
      tabId === this.session.state.tabId
        ? this.session
        : tabId === null
          ? undefined
          : this.away.get(tabId);
    if (session && !session.connection) this.pageGone(session);
  }

  /** Closes the inspect card, puts any tried text back, and clears its outline. */
  closeInspect(): void {
    this.set({ picked: null });
    this.session.connection?.request('tryText', { value: null }).catch(() => undefined);
    this.highlight(null);
  }

  /**
   * Puts a text in the picked element and measures it; `null` puts the
   * element's own text back. Null when the page can't be reached.
   */
  async tryText(value: TextValueDto | null, findingId?: string): Promise<TextTrialDto | null> {
    // Nothing was tried on a page the panel isn't connected to.
    if (value === null && !this.session.connection) return null;
    try {
      const connection = await this.ensureConnection(this.session);
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
      const connection = await this.ensureConnection(this.session);
      return await connection.request('textOf', findingId === undefined ? {} : { findingId });
    } catch {
      return null;
    }
  }

  /** Back to the start screen. Longer text, if any, stays until it's put back. */
  clearResults(): void {
    this.set({ scan: null, stress: null, showing: null, stale: false, picked: null });
  }

  dismissError(): void {
    this.set({ error: null });
  }

  /**
   * Closes every page connection (each page reverts). Subscribers stay, for
   * React's StrictMode.
   */
  dispose(): void {
    for (const session of this.away.values()) this.close(session);
    this.away.clear();
    this.close(this.session);
  }

  /**
   * Issues ignored on the current site (by fingerprint). The toolbar badge
   * leaves them out; the panel decides whether to show them.
   */
  setIgnored(ids: ReadonlySet<string>): void {
    if (ids.size === this.ignored.size && [...ids].every((id) => this.ignored.has(id))) return;
    this.ignored = ids;
    if (this.session.badged) this.badge(this.session, this.session.badged);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /** Changes a tab's state; only the tab on screen tells the panel. */
  private update(session: Session, patch: Partial<PanelState>): void {
    session.state = { ...session.state, ...patch };
    if (session === this.session) this.notify();
  }

  private set(patch: Partial<PanelState>): void {
    this.update(this.session, patch);
  }

  /**
   * Keeps a tab the panel looks away from: its results, and its connection,
   * so longer text stays on its page until it's put back or the panel closes.
   * The picker stops, and tried text, a previewed fix and outlines go away,
   * since nobody is looking. A tab with nothing to keep is let go.
   */
  private leave(session: Session): void {
    const { tabId, scan, stress } = session.state;
    const { connection } = session;
    if (tabId === null || (!connection && !session.connecting && !scan && !stress)) {
      this.close(session);
      return;
    }
    if (connection) {
      const quiet = () => undefined;
      if (session.state.picking) connection.request('pick', { active: false }).catch(quiet);
      connection.request('tryText', { value: null }).catch(quiet);
      connection.request('preview', { findingId: '', key: null }).catch(quiet);
      connection.request('highlight', { findingId: null }).catch(quiet);
    }
    // A revert that happened here was confirmed already; coming back mustn't say it again.
    session.state = { ...session.state, picking: false, restored: null };
    this.away.set(tabId, session);
  }

  private pageGone(session: Session): void {
    session.navigations += 1;
    this.close(session);
    const { tabId, scan, stress } = session.state;
    if (tabId !== null) this.deps.setBadge(tabId, null);
    this.update(session, {
      connection: 'idle',
      failure: null,
      page: null,
      stressActive: false,
      pending: 0,
      picking: false,
      stale: scan !== null || stress !== null,
    });
  }

  private async scanIn(session: Session, includeInputs: boolean): Promise<void> {
    session.includeInputs = includeInputs;
    await this.run(session, 'scan', async (connection) => {
      const scan = await connection.request('scan', { includeInputs });
      this.update(session, { scan, showing: 'scan', stale: false, picked: null });
      this.badge(session, scan.issues);
    });
  }

  /**
   * The list always describes the page as it is: once the text is back to
   * normal, results taken with longer text are replaced by a fresh check.
   */
  private async checkAfterRevert(session: Session): Promise<void> {
    const { showing, stressActive, connection } = session.state;
    if (showing === 'stress' && !stressActive && connection === 'ready') {
      await this.scanIn(session, session.includeInputs);
    }
  }

  /** Numbers reverts across tabs, so the panel confirms each one once. */
  private nextRestored(texts: number): PanelState['restored'] {
    this.restoredSeq += 1;
    return { texts, seq: this.restoredSeq };
  }

  private badge(session: Session, issues: readonly IssueDto[]): void {
    session.badged = issues;
    const { tabId } = session.state;
    if (tabId === null) return;
    // Ignore rules are the site on screen's; a tab left behind keeps the count it had.
    const ignored = session === this.session ? this.ignored : new Set<string>();
    this.deps.setBadge(
      tabId,
      issues.filter((issue) => !ignored.has(issue.id)),
    );
  }

  private async run(
    session: Session,
    busy: Busy | null,
    work: (connection: PageConnection) => Promise<unknown>,
  ): Promise<void> {
    if (busy && session.state.busy) return;
    const navigations = session.navigations;
    if (busy) this.update(session, { busy, error: null });
    try {
      const connection = await this.ensureConnection(session);
      await work(connection);
    } catch (error) {
      // The page may have navigated while we waited; the stale notice says so.
      const cancelled = error instanceof RequestError && error.code === 'cancelled';
      const moved = navigations !== session.navigations;
      if (!moved && !cancelled && !(error instanceof ConnectionError)) {
        this.update(session, { error: message(error) });
      }
    } finally {
      if (busy) this.update(session, { busy: null, progress: null });
    }
  }

  private ensureConnection(session: Session): Promise<PageConnection> {
    if (session.connection) return Promise.resolve(session.connection);
    if (session.connecting) return session.connecting;
    const { tabId } = session.state;
    if (tabId === null) return Promise.reject(new Error('No tab to work on.'));

    this.update(session, { connection: 'connecting', failure: null });
    const connecting = this.deps.connect(tabId).then(
      ({ connection, page }) => {
        if (session.connecting !== connecting) {
          connection.close();
          throw new Error('The tab changed.');
        }
        session.connecting = null;
        session.connection = connection;
        this.listen(session, connection);
        this.update(session, { connection: 'ready', page });
        return connection;
      },
      (error: unknown) => {
        if (session.connecting === connecting) {
          session.connecting = null;
          this.update(
            session,
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
    session.connecting = connecting;
    return connecting;
  }

  private listen(session: Session, connection: PageConnection): void {
    connection.onEvent((event) => {
      if (connection !== session.connection) return;
      switch (event.type) {
        case 'progress':
          if (session.state.busy) {
            this.update(session, {
              progress: { phase: event.phase, textNodes: event.textNodes },
            });
          }
          break;
        case 'pending':
          this.update(session, { pending: event.count });
          break;
        case 'reverted':
          // The button on the page put the text back.
          this.update(session, {
            stressActive: false,
            pending: 0,
            restored: this.nextRestored(event.result.restored),
          });
          void this.checkAfterRevert(session);
          break;
        case 'picked':
          this.update(session, { picking: false, picked: event.picked });
          break;
        case 'pick-cancelled':
          this.update(session, { picking: false });
          break;
        case 'navigated':
          this.pageGone(session);
          break;
      }
    });
    connection.onClose((expected) => {
      if (connection !== session.connection) return;
      session.connection = null;
      // Unexpected: a new document loaded, or the tab closed or went into the back/forward cache.
      if (!expected) this.pageGone(session);
    });
  }

  /** Ends a tab's connection; its page puts longer text back and removes its overlay. */
  private close(session: Session): void {
    session.connecting = null;
    const { connection } = session;
    session.connection = null;
    connection?.close();
  }
}
