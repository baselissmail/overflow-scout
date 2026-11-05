/**
 * Public types of the detection engine. Findings hold live element references;
 * the extension runtime turns them into serializable DTOs before messaging.
 */

/** What kind of overflow problem a finding describes (plan §3.3). */
export type FindingKind = 'hidden' | 'page-scroll' | 'truncated' | 'spilling' | 'input';

export type Severity = 'critical' | 'warning' | 'notice';

/** How the content is lost or misplaced. */
export type Mechanism =
  | 'clip' // cut off by overflow: hidden/clip, with no visual cue
  | 'ellipsis' // cut off with text-overflow: ellipsis
  | 'line-clamp' // cut off by (-webkit-)line-clamp
  | 'spill' // overflows its box visibly
  | 'page-overflow' // widens the page and causes horizontal scroll
  | 'placeholder' // input placeholder doesn't fit
  | 'value'; // read-only input value doesn't fit

export type Axis = 'x' | 'y';

export const SEVERITY_BY_KIND: Readonly<Record<FindingKind, Severity>> = {
  hidden: 'critical',
  'page-scroll': 'critical',
  truncated: 'warning',
  spilling: 'warning',
  input: 'notice',
};

export const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  critical: 0,
  warning: 1,
  notice: 2,
};

/** One CSS fact that contributes to a finding. */
export interface Cause {
  element: Element;
  property: string;
  value: string;
  /** Plain-language explanation, e.g. "width stays 120px while text needs 214px". */
  note: string;
}

export interface Diagnosis {
  /** High when a single declared property explains the finding. */
  confidence: 'high' | 'medium';
  causes: Cause[];
}

export interface Finding {
  kind: FindingKind;
  severity: Severity;
  mechanism: Mechanism;
  /** The element whose text is affected (text host, input, or page-scroll culprit). */
  element: Element;
  /** The element that clips or is overflowed (for page-scroll: the element itself). */
  container: Element;
  axes: Axis[];
  /** CSS pixels of content that don't fit, per axis. */
  overflow: { x: number; y: number };
  /** Sample of the affected text (whitespace collapsed, at most 120 characters). */
  text: string;
  diagnosis: Diagnosis;
}

export interface ScanStats {
  /** Text nodes measured. */
  textNodes: number;
  inputs: number;
  /** Text skipped because it isn't rendered (display: none, hidden, opacity 0, ...). */
  skippedInvisible: number;
  /** Text inside SVG or MathML, out of scope for v1. */
  skippedForeign: number;
  shadowRoots: number;
  /** Frames are not scanned in v1 (plan §1.4). */
  framesSkipped: number;
  /** Time spent working, excluding pauses between slices. */
  durationMs: number;
  /** Wall-clock time from start to finish. */
  wallMs: number;
  slices: number;
  longestSliceMs: number;
}

export interface ScanResult {
  findings: Finding[];
  stats: ScanStats;
  viewport: { width: number; height: number };
}

export interface ScanOptions {
  /** Leave out elements (and their subtrees), e.g. the extension's own UI host. */
  ignore?: (element: Element) => boolean;
  /** Opens closed shadow roots; the extension passes `chrome.dom.openOrClosedShadowRoot`. */
  openShadowRoot?: (element: Element) => ShadowRoot | null;
  /** Work budget per slice for `scanDocumentAsync`, in ms. Default 8. */
  sliceMs?: number;
  /** Clock, injectable for tests. Defaults to the document's `performance.now`. */
  now?: () => number;
  /** Yields to the host between slices. Defaults to `scheduler.yield()` or a macrotask. */
  yieldToHost?: () => Promise<void>;
}
