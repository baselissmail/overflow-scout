import type { Finding, Fix, FixTrials, StressSession, StyleEdit, TraversalOptions } from '@/core';
import {
  applyDeclarations,
  elementLabel,
  elementSelector,
  findBreakingPoint,
  fixCss,
  fixesFor,
  runStressTest,
  sampleText,
  scanDocumentAsync,
  textCut,
  tryFixes,
} from '@/core';
import type {
  PageInfo,
  PageMessage,
  PageRequest,
  PickedElement,
  ProgressPhase,
  ResultOf,
  RevertResultDto,
} from '@/messaging/protocol';

import type { OverlayText } from './overlay';
import { Overlay } from './overlay';
import { Picker } from './picker';
import { FindingRegistry, toIssueDtos } from './serialize';

export interface SessionOptions {
  /** Opens closed shadow roots (`chrome.dom.openOrClosedShadowRoot` in content scripts). */
  openShadowRoot?: (element: Element) => ShadowRoot | null;
  text: OverlayText;
}

type Handlers = {
  [T in PageRequest['type']]: (
    request: Extract<PageRequest, { type: T }>,
  ) => ResultOf<T> | Promise<ResultOf<T>>;
};

/**
 * One panel connection to the page. Owns the overlay, the picker, and any
 * stress text; `dispose()` (on disconnect, tab switch, navigation, panel
 * close) leaves the page exactly as it was (plan §2.3).
 */
export class PageSession {
  private readonly overlay: Overlay;
  private readonly picker: Picker;
  private readonly registry = new FindingRegistry();
  private stress: StressSession | null = null;
  private stopWatching: (() => void) | null = null;
  /** Heavy work (scan, stress, revert) runs one at a time. */
  private queue: Promise<unknown> = Promise.resolve();
  /** Cancels the scan or stress test in progress. */
  private work: AbortController | null = null;
  /** The element last chosen with the picker, for stress tests scoped to it. */
  private picked: Element | null = null;
  private lastProgressAt = 0;
  private disposed = false;
  /** The fixes last tried, so a preview applies exactly what was measured. */
  private tried: { findingId: string; fixes: Fix<Element>[]; result: FixTrials } | null = null;
  /** A fix kept on the page so it can be seen; undone before any other work. */
  private preview: StyleEdit | null = null;

  constructor(
    private readonly doc: Document,
    private readonly send: (message: PageMessage) => void,
    private readonly options: SessionOptions,
  ) {
    this.overlay = new Overlay(doc, options.text);
    this.picker = new Picker(
      doc,
      this.overlay,
      (element) => {
        this.send({ type: 'picked', picked: this.describePicked(element) });
      },
      () => {
        this.send({ type: 'pick-cancelled' });
      },
    );
  }

  private get traversal(): TraversalOptions {
    return {
      ignore: (element) => this.overlay.owns(element),
      ...(this.options.openShadowRoot && { openShadowRoot: this.options.openShadowRoot }),
    };
  }

  /** Runs a request and replies with its result or an error message. */
  async handle(request: PageRequest): Promise<void> {
    if (!this.live()) return;
    try {
      const handler = this.handlers[request.type] as (request: PageRequest) => unknown;
      const result = await handler(request);
      if (this.live()) this.send({ type: 'result', id: request.id, result });
    } catch (error) {
      if (this.live()) {
        const cancelled = error instanceof DOMException && error.name === 'AbortError';
        const message = error instanceof Error ? error.message : String(error);
        this.send({
          type: 'error',
          id: request.id,
          message,
          ...(cancelled && { code: 'cancelled' as const }),
        });
      }
    }
  }

  /** A method, not a field read, so checks after an `await` aren't narrowed away. */
  private live(): boolean {
    return !this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.work?.abort();
    this.picker.stop();
    this.endPreview();
    this.endStress();
    this.overlay.destroy();
    this.registry.clear();
  }

  private readonly handlers: Handlers = {
    hello: () => this.pageInfo(),
    scan: ({ includeInputs }) =>
      this.cancellable(async (signal) => {
        const result = await scanDocumentAsync(this.doc, {
          ...this.traversal,
          includeInputs,
          signal,
          onProgress: (textNodes) => {
            this.progress('scan', textNodes);
          },
        });
        this.registry.clear();
        return {
          issues: toIssueDtos(result.findings, this.registry),
          stats: result.stats,
          viewport: result.viewport,
        };
      }),
    stress: ({ options, scope, includeInputs }) =>
      this.cancellable(async (signal) => {
        const region = scope === 'picked' ? this.picked : null;
        if (scope === 'picked' && !region?.isConnected) {
          throw new Error('Pick an element on the page first.');
        }
        this.endStress();
        const result = await runStressTest(this.doc, {
          ...options,
          ...this.traversal,
          ...(region && { scope: region }),
          includeInputs,
          signal,
          onProgress: (phase, textNodes) => {
            this.progress(phase, textNodes);
          },
        });
        const session = result.session;
        this.stress = session;
        this.stopWatching = session.watch((count) => {
          this.send({ type: 'pending', count });
        });
        this.overlay.showStressPill(() => {
          const reverted = this.endStress();
          this.send({ type: 'reverted', result: reverted });
        });
        this.registry.clear();
        return {
          brokenNow: toIssueDtos(result.brokenNow, this.registry),
          atRisk: toIssueDtos(result.atRisk, this.registry, (element) =>
            session.originalTextOf(element),
          ),
          viewport: this.pageInfo().viewport,
          stats: result.stats,
        };
      }),
    cancel: () => {
      this.work?.abort();
      return null;
    },
    revert: () =>
      this.serial(() => {
        this.endPreview();
        this.tried = null;
        return Promise.resolve(this.endStress());
      }),
    reapply: () =>
      this.serial(async () => {
        if (!this.stress) return { strings: 0 };
        const stats = await this.stress.apply();
        return { strings: stats.strings };
      }),
    highlight: ({ findingId }) => {
      const finding = findingId === null ? undefined : this.registry.get(findingId);
      this.overlay.highlight(
        finding
          ? {
              element: finding.element,
              container: finding.container,
              label: elementLabel(finding.element),
            }
          : null,
      );
      return null;
    },
    reveal: ({ findingId }) => {
      const finding = this.registry.get(findingId);
      if (!finding) throw new Error('This result is from an earlier scan. Scan again.');
      this.reveal(finding);
      return null;
    },
    details: ({ findingId }) => {
      const finding = this.registry.get(findingId);
      if (!finding?.element.isConnected) return null;
      return {
        selector: elementSelector(finding.element),
        cut: textCut(finding, this.traversal),
      };
    },
    pick: ({ active }) => {
      if (active) this.picker.start();
      else this.picker.stop();
      return null;
    },
    fixes: ({ findingId }) => {
      this.endPreview();
      const finding = this.registry.get(findingId);
      if (!finding?.element.isConnected) return null;
      const fixes = fixesFor(finding);
      const result = tryFixes(finding, fixes, this.traversal);
      this.tried = { findingId, fixes, result };
      return {
        trials: fixes.flatMap((fix) => {
          const trial = result.trials[fix.key];
          return trial ? [{ key: fix.key, trial }] : [];
        }),
        added: result.added.map((fix) => ({
          key: fix.key,
          css: fixCss(fix) ?? '',
          element: { label: elementLabel(fix.element) },
        })),
        combined: result.combined,
      };
    },
    preview: ({ findingId, key }) => {
      this.endPreview();
      if (key === null) return null;
      const finding = this.registry.get(findingId);
      if (!finding?.element.isConnected)
        throw new Error('This result is from an earlier scan. Scan again.');
      if (this.tried?.findingId !== findingId) {
        const fixes = fixesFor(finding);
        this.tried = { findingId, fixes, result: tryFixes(finding, fixes, this.traversal) };
      }
      const all = [...this.tried.fixes, ...this.tried.result.added].filter(
        (fix) => fix.declarations.length > 0,
      );
      const chosen = key === 'all' ? all : all.filter((fix) => fix.key === key);
      if (chosen.length === 0) throw new Error('This fix has no CSS to preview.');
      // Page transitions stay on, so the fix eases in the way the page would show it.
      this.preview = applyDeclarations(chosen, { transitions: true });
      this.reveal(finding);
      return null;
    },
  };

  /** Scrolls a finding into view and pulses its outline. */
  private reveal(finding: Finding): void {
    const reduced = this.doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    finding.element.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    });
    this.overlay.highlight(
      {
        element: finding.element,
        container: finding.container,
        label: elementLabel(finding.element),
      },
      true,
    );
  }

  private endPreview(): void {
    this.preview?.undo();
    this.preview = null;
  }

  /** Runs heavy work one at a time with a fresh abort signal for `cancel`. */
  private cancellable<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return this.serial(async () => {
      // Results describe the page as it is, not with a previewed fix.
      this.endPreview();
      this.tried = null;
      const controller = new AbortController();
      this.work = controller;
      this.lastProgressAt = 0;
      try {
        return await work(controller.signal);
      } finally {
        if (this.work === controller) this.work = null;
      }
    });
  }

  /** Reports progress at most every 100 ms. */
  private progress(phase: ProgressPhase, textNodes: number): void {
    const now = Date.now();
    if (now - this.lastProgressAt < 100) return;
    this.lastProgressAt = now;
    this.send({ type: 'progress', phase, textNodes });
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private endStress(): RevertResultDto {
    this.stopWatching?.();
    this.stopWatching = null;
    this.overlay.hideStressPill();
    const result = this.stress?.revert() ?? { restored: 0, keptPageChanges: 0 };
    this.stress = null;
    return result;
  }

  private pageInfo(): PageInfo {
    const root = this.doc.documentElement;
    return {
      url: this.doc.URL,
      title: this.doc.title,
      viewport: { width: root.clientWidth, height: root.clientHeight },
    };
  }

  private describePicked(element: Element): PickedElement {
    this.picked = element;
    const rect = element.getBoundingClientRect();
    const result = findBreakingPoint(element, this.traversal);
    this.overlay.highlight({ element, label: elementLabel(element) });
    return {
      element: { label: elementLabel(element), selector: elementSelector(element) },
      size: { width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10 },
      text: sampleText(element.textContent),
      breakingPoint: result && {
        length: result.length,
        fitsUpTo: result.fitsUpTo,
        maxTested: result.maxTested,
        needs: result.needs,
        verdict: result.verdict,
        breaksAs: result.breaksAs,
      },
    };
  }
}
