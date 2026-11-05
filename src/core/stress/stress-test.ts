import { scanDocumentAsync } from '../scan';
import type { Axis, Cause, Finding, FindingKind, ScanOptions, ScanStats } from '../types';
import type { Size, StressOptions, StressStats } from './session';
import { StressSession } from './session';

/** A problem that only appears with longer text. */
export interface AtRiskFinding extends Finding {
  /** How much longer the element's text became (after ÷ before), when known. */
  growth: number | null;
}

export interface StressTestResult {
  /** The session that holds the stress text; call `revert()` to undo it. */
  session: StressSession;
  /** Problems on the page as it was before stress. */
  brokenNow: Finding[];
  /** Problems that appear only with the longer text (plan §3.3, "at risk"). */
  atRisk: AtRiskFinding[];
  stats: {
    baseline: ScanStats;
    stress: StressStats;
    stressed: ScanStats;
    /** Work across all three phases, excluding pauses. */
    durationMs: number;
    longestSliceMs: number;
  };
}

const round = (value: number) => Math.round(value * 10) / 10;
const pxText = (value: number) => `${String(round(value))}px`;

/**
 * Explains an at-risk finding by behavior rather than declared CSS (plan §3.4):
 * if the box kept its size on an axis where the text grew, that axis is
 * constrained, whatever the computed values say.
 */
function behaviorCause(
  finding: Finding,
  axis: Axis,
  before: Size,
  after: Size,
  growth: number | null,
): Cause {
  const dimension = axis === 'x' ? 'width' : 'height';
  const label = axis === 'x' ? 'Width' : 'Height';
  const was = before[dimension];
  const now = after[dimension];
  const needed = now + finding.overflow[axis];
  const grew = growth === null ? 'grew' : `grew ${String(growth)}×`;
  let note: string;
  if (Math.abs(now - was) <= 0.5) {
    note = `${label} stayed ${pxText(was)} while the text ${grew}; it needs about ${pxText(needed)}.`;
  } else if (now > was) {
    note = `${label} grew from ${pxText(was)} to ${pxText(now)}, but the text needs about ${pxText(needed)}.`;
  } else {
    note = `${label} shrank from ${pxText(was)} to ${pxText(now)} as the text around it grew.`;
  }
  return { element: finding.container, property: dimension, value: pxText(was), note };
}

function withEvidence(finding: Finding, session: StressSession): AtRiskFinding {
  const growth = session.growthOf(finding.element);
  const before = session.sizeBefore(finding.container);
  if (!before) return { ...finding, growth };

  const rect = finding.container.getBoundingClientRect();
  const after = { width: rect.width, height: rect.height };
  const evidence = finding.axes.map((axis) => behaviorCause(finding, axis, before, after, growth));
  const replaced = new Set(evidence.map((cause) => cause.property));
  // The behavioral cause supersedes the generic "the box is N px wide" one.
  const others = finding.diagnosis.causes.filter(
    (cause) => !(cause.element === finding.container && replaced.has(cause.property)),
  );
  const fixed = finding.axes.some((axis) => {
    const dimension = axis === 'x' ? 'width' : 'height';
    return Math.abs(after[dimension] - before[dimension]) <= 0.5;
  });
  return {
    ...finding,
    growth,
    diagnosis: {
      confidence: fixed ? 'high' : finding.diagnosis.confidence,
      causes: [...evidence, ...others],
    },
  };
}

/**
 * Runs a stress test: scans the page as it is, applies stress text, scans
 * again, and reports what breaks only with longer text. The stress text stays
 * on the page so it can be inspected; call `result.session.revert()` to undo.
 */
export async function runStressTest(
  doc: Document,
  options: StressOptions = {},
): Promise<StressTestResult> {
  const scanOptions: ScanOptions = {
    ...(options.ignore && { ignore: options.ignore }),
    ...(options.openShadowRoot && { openShadowRoot: options.openShadowRoot }),
    ...(options.sliceMs !== undefined && { sliceMs: options.sliceMs }),
    ...(options.now && { now: options.now }),
    ...(options.yieldToHost && { yieldToHost: options.yieldToHost }),
    ...(options.scope && { root: options.scope }),
  };

  const baseline = await scanDocumentAsync(doc, scanOptions);
  const session = new StressSession(doc, options);
  let stress: StressStats;
  let stressed: Awaited<ReturnType<typeof scanDocumentAsync>>;
  try {
    stress = await session.apply();
    stressed = await scanDocumentAsync(doc, scanOptions);
  } catch (error) {
    session.revert();
    throw error;
  }

  const before = new Map<Element, Set<FindingKind>>();
  for (const finding of baseline.findings) {
    const kinds = before.get(finding.element) ?? new Set<FindingKind>();
    kinds.add(finding.kind);
    before.set(finding.element, kinds);
  }
  const atRisk = stressed.findings
    .filter((finding) => !before.get(finding.element)?.has(finding.kind))
    .map((finding) => withEvidence(finding, session));

  return {
    session,
    brokenNow: baseline.findings,
    atRisk,
    stats: {
      baseline: baseline.stats,
      stress,
      stressed: stressed.stats,
      durationMs: round(baseline.stats.durationMs + stress.durationMs + stressed.stats.durationMs),
      longestSliceMs: Math.max(
        baseline.stats.longestSliceMs,
        stress.longestSliceMs,
        stressed.stats.longestSliceMs,
      ),
    },
  };
}
