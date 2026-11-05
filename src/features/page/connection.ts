import { browser } from 'wxt/browser';
import type { Browser } from 'wxt/browser';

import type {
  PageInfo,
  PageMessage,
  PageRequestType,
  RequestParams,
  ResultOf,
} from '@/messaging/protocol';
import { PAGE_PORT, pageMessageSchema, pageResultSchemas } from '@/messaging/protocol';

/** Why the panel can't work on a tab, each with its own message and action (plan §5.4). */
export type ConnectionFailure =
  | { reason: 'restricted' }
  | { reason: 'no-access'; origin: string | null }
  | { reason: 'file-access' }
  | { reason: 'error'; message: string };

/** A request the page answered with an error. `cancelled` means the user stopped it. */
export class RequestError extends Error {
  constructor(
    message: string,
    readonly code?: 'cancelled',
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

export class ConnectionError extends Error {
  constructor(readonly failure: ConnectionFailure) {
    super(failure.reason === 'error' ? failure.message : failure.reason);
    this.name = 'ConnectionError';
  }
}

const RUNTIME_FILE = '/content-scripts/scout.js';

/** Schemes and hosts Chrome never lets extensions script. */
const RESTRICTED = [
  /Cannot access a chrome:\/\/ URL/i,
  /Cannot access a chrome-extension:\/\/ URL of different extension/i,
  /cannot be scripted/i,
  /Cannot access contents of url "(chrome|chrome-search|chrome-untrusted|devtools|edge|about|view-source|data|blob):/i,
  /showing error page/i,
];

function originOf(url: string): string | null {
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/** Maps `scripting.executeScript` errors to something the panel can explain. */
export function classifyInjectionError(message: string): ConnectionFailure {
  if (RESTRICTED.some((pattern) => pattern.test(message))) return { reason: 'restricted' };
  const url = /Cannot access contents of url "([^"]+)"/i.exec(message)?.[1];
  if (url?.startsWith('file:')) return { reason: 'file-access' };
  if (/must request permission|Cannot access contents of (the page|url)/i.test(message)) {
    return { reason: 'no-access', origin: url ? originOf(url) : null };
  }
  return { reason: 'error', message };
}

type EventMessage = Exclude<PageMessage, { type: 'result' | 'error' }>;

interface Pending {
  type: PageRequestType;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

/**
 * A session with the page runtime in one tab, over one port. The runtime is
 * injected on first use; on extension pages (the demo) it is already there.
 * Closing the connection makes the page revert everything (plan §2.3).
 */
export class PageConnection {
  private readonly pending = new Map<number, Pending>();
  private readonly eventListeners = new Set<(message: EventMessage) => void>();
  private readonly closeListeners = new Set<(expected: boolean) => void>();
  private nextId = 1;
  private closed = false;

  private constructor(
    readonly tabId: number,
    private readonly port: Browser.runtime.Port,
  ) {
    port.onMessage.addListener((message: unknown) => {
      this.receive(message);
    });
    port.onDisconnect.addListener(() => {
      this.finish(false);
    });
  }

  /** Connects to the page runtime in a tab, injecting it if needed. */
  static async open(tabId: number): Promise<{ connection: PageConnection; page: PageInfo }> {
    const first = await PageConnection.tryConnect(tabId);
    if (first) return first;
    try {
      await browser.scripting.executeScript({ target: { tabId }, files: [RUNTIME_FILE] });
    } catch (error) {
      throw new ConnectionError(
        classifyInjectionError(error instanceof Error ? error.message : String(error)),
      );
    }
    const second = await PageConnection.tryConnect(tabId);
    if (second) return second;
    throw new ConnectionError({ reason: 'error', message: 'The page did not respond.' });
  }

  /** Resolves null when nothing in the tab is listening (the runtime isn't injected yet). */
  private static async tryConnect(
    tabId: number,
  ): Promise<{ connection: PageConnection; page: PageInfo } | null> {
    const port = browser.tabs.connect(tabId, { name: PAGE_PORT, frameId: 0 });
    const connection = new PageConnection(tabId, port);
    try {
      const page = await connection.request('hello', {});
      return { connection, page };
    } catch {
      connection.close();
      return null;
    }
  }

  request<T extends PageRequestType>(type: T, params: RequestParams<T>): Promise<ResultOf<T>> {
    if (this.closed) return Promise.reject(new Error('The page connection is closed.'));
    const id = this.nextId++;
    return new Promise<ResultOf<T>>((resolve, reject) => {
      this.pending.set(id, {
        type,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.port.postMessage({ id, type, ...params });
    });
  }

  onEvent(listener: (message: EventMessage) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** `expected` is true when the panel closed the connection itself. */
  onClose(listener: (expected: boolean) => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  close(): void {
    if (this.closed) return;
    this.port.disconnect();
    this.finish(true);
  }

  private finish(expected: boolean): void {
    if (this.closed) return;
    this.closed = true;
    for (const { reject } of this.pending.values()) {
      reject(new Error('The page went away.'));
    }
    this.pending.clear();
    for (const listener of this.closeListeners) listener(expected);
  }

  private receive(raw: unknown): void {
    const parsed = pageMessageSchema.safeParse(raw);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.type === 'result' || message.type === 'error') {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.type === 'error') {
        pending.reject(new RequestError(message.message, message.code));
        return;
      }
      const result = pageResultSchemas[pending.type].safeParse(message.result);
      if (result.success) pending.resolve(result.data);
      else pending.reject(new Error('The page sent an invalid reply.'));
      return;
    }
    for (const listener of this.eventListeners) listener(message);
  }
}
