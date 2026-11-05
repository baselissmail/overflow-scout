import type { StressSession, TraversalOptions } from '@/core';
import {
  elementLabel,
  elementSelector,
  findBreakingPoint,
  runStressTest,
  sampleText,
  scanDocumentAsync,
} from '@/core';
import type {
  PageInfo,
  PageMessage,
  PageRequest,
  PickedElement,
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
  private disposed = false;

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
        const message = error instanceof Error ? error.message : String(error);
        this.send({ type: 'error', id: request.id, message });
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
    this.picker.stop();
    this.endStress();
    this.overlay.destroy();
    this.registry.clear();
  }

  private readonly handlers: Handlers = {
    hello: () => this.pageInfo(),
    scan: () =>
      this.serial(async () => {
        const result = await scanDocumentAsync(this.doc, this.traversal);
        this.registry.clear();
        return {
          issues: toIssueDtos(result.findings, this.registry),
          stats: result.stats,
          viewport: result.viewport,
        };
      }),
    stress: ({ options }) =>
      this.serial(async () => {
        this.endStress();
        const result = await runStressTest(this.doc, { ...options, ...this.traversal });
        this.stress = result.session;
        this.stopWatching = result.session.watch((count) => {
          this.send({ type: 'pending', count });
        });
        this.overlay.showStressPill(() => {
          const reverted = this.endStress();
          this.send({ type: 'reverted', result: reverted });
        });
        this.registry.clear();
        return {
          brokenNow: toIssueDtos(result.brokenNow, this.registry),
          atRisk: toIssueDtos(result.atRisk, this.registry),
          stats: result.stats,
        };
      }),
    revert: () => this.serial(() => Promise.resolve(this.endStress())),
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
      return null;
    },
    pick: ({ active }) => {
      if (active) this.picker.start();
      else this.picker.stop();
      return null;
    },
  };

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
