import { windowOf } from './dom';
import type { SliceOptions, SliceTiming } from './types';

const DEFAULT_SLICE_MS = 8;

const round = (value: number) => Math.round(value * 10) / 10;

export function clockFor(doc: Document, options: SliceOptions): () => number {
  if (options.now) return options.now;
  const { performance } = windowOf(doc);
  return () => performance.now();
}

/** `scheduler.yield()` resumes ahead of other queued tasks (Chrome 129+; we require 142). */
function yieldFor(doc: Document, options: SliceOptions): () => Promise<void> {
  if (options.yieldToHost) return options.yieldToHost;
  const view = windowOf(doc);
  return () => view.scheduler.yield();
}

/** Accumulates slice timings. */
export class SliceTimer {
  private readonly timing: SliceTiming = { durationMs: 0, wallMs: 0, slices: 0, longestSliceMs: 0 };

  record(durationMs: number): void {
    this.timing.slices += 1;
    this.timing.durationMs += durationMs;
    this.timing.longestSliceMs = Math.max(this.timing.longestSliceMs, durationMs);
  }

  finish(wallMs: number): SliceTiming {
    return {
      durationMs: round(this.timing.durationMs),
      wallMs: round(wallMs),
      slices: this.timing.slices,
      longestSliceMs: round(this.timing.longestSliceMs),
    };
  }
}

/** Adds one synchronous slice of work, timed by the caller, to a timing. */
export function withSlice(timing: SliceTiming, durationMs: number): SliceTiming {
  return {
    durationMs: round(timing.durationMs + durationMs),
    wallMs: round(timing.wallMs + durationMs),
    slices: timing.slices + 1,
    longestSliceMs: round(Math.max(timing.longestSliceMs, durationMs)),
  };
}

/** Runs every step at once. For tests, small documents, and work that must not pause. */
export function runToEnd(
  doc: Document,
  steps: Iterator<unknown>,
  options: SliceOptions = {},
): SliceTiming {
  const now = clockFor(doc, options);
  const started = now();
  while (!steps.next().done) {
    // Run every step without pausing.
  }
  const elapsed = now() - started;
  const timer = new SliceTimer();
  timer.record(elapsed);
  return timer.finish(elapsed);
}

/**
 * Runs steps in time slices (default 8 ms of work each), yielding to the page
 * between slices so no task comes near the 50 ms long-task threshold.
 * `onResume` runs after every pause, because the page may have changed.
 */
export async function runInSlices(
  doc: Document,
  steps: Iterator<unknown>,
  options: SliceOptions = {},
  onResume?: () => void,
): Promise<SliceTiming> {
  const now = clockFor(doc, options);
  const sliceMs = options.sliceMs ?? DEFAULT_SLICE_MS;
  const yieldToHost = yieldFor(doc, options);
  const timer = new SliceTimer();

  const started = now();
  let sliceStart = started;
  while (!steps.next().done) {
    if (now() - sliceStart >= sliceMs) {
      timer.record(now() - sliceStart);
      await yieldToHost();
      onResume?.();
      sliceStart = now();
    }
  }
  timer.record(now() - sliceStart);
  return timer.finish(now() - started);
}
