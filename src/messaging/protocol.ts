/**
 * The contract between the side panel, the page runtime and the service
 * worker: the single source of truth for every message (plan §2.3, §6.3).
 *
 * The panel talks to the page over one long-lived port per session, so the
 * service worker stays out of the hot path. Every message is validated on
 * arrival with these schemas; nothing from another context is trusted.
 * `zod/mini` keeps the page runtime small.
 */
import * as z from 'zod/mini';

import {
  FINDING_KINDS,
  FIX_KEYS,
  SAMPLE_LANGUAGES,
  STRESS_INTENSITIES,
  STRESS_STRATEGIES,
} from '@/core';

/** Name of the panel ↔ page port. */
export const PAGE_PORT = 'overflow-scout/page';

const count = z.number().check(z.int(), z.nonnegative());
const ms = z.number().check(z.nonnegative());
const px = z.number();

// ── Data ────────────────────────────────────────────────────────────────────

export const findingKindSchema = z.enum(FINDING_KINDS);
export const severitySchema = z.enum(['critical', 'warning', 'notice']);
const mechanismSchema = z.enum([
  'clip',
  'ellipsis',
  'line-clamp',
  'spill',
  'page-overflow',
  'placeholder',
  'value',
]);

/** An element on the page, as the panel sees it. */
export const elementRefSchema = z.object({
  /** Short path such as `nav › a.nav-link`. */
  label: z.string(),
  /** Unique selector, computed only where someone is likely to look. */
  selector: z.optional(z.string()),
});

const causeSchema = z.object({
  element: elementRefSchema,
  property: z.string(),
  value: z.string(),
  note: z.string(),
});

export const findingSchema = z.object({
  /** Session-scoped id; the page keeps the live element for highlight and reveal. */
  id: z.string(),
  kind: findingKindSchema,
  severity: severitySchema,
  mechanism: mechanismSchema,
  axes: z.array(z.enum(['x', 'y'])),
  overflow: z.object({ x: px, y: px }),
  text: z.string(),
  element: elementRefSchema,
  container: elementRefSchema,
  diagnosis: z.object({
    confidence: z.enum(['high', 'medium']),
    causes: z.array(causeSchema),
  }),
  /** Size of the container box, for the measure bar ("has 120 px · needs 214 px"). */
  box: z.object({ width: px, height: px }),
  /** Text growth under stress (after ÷ before); only for at-risk findings. */
  growth: z.optional(z.nullable(z.number())),
  /** The element's text before stress; only for at-risk findings. */
  before: z.optional(z.nullable(z.string())),
  /** Where the text is cut; sent for the first place of each issue, the rest load on demand. */
  cut: z.optional(z.nullable(z.object({ visible: z.string(), hidden: z.string() }))),
});

export const issueSchema = z.object({
  id: z.string(),
  /** Position of the issue's first instance in the page, for sorting by page order. */
  order: count,
  kind: findingKindSchema,
  severity: severitySchema,
  instances: z.array(findingSchema).check(z.minLength(1)),
});

const timingShape = { durationMs: ms, wallMs: ms, slices: count, longestSliceMs: ms };

export const scanStatsSchema = z.object({
  textNodes: count,
  inputs: count,
  skippedInvisible: count,
  skippedForeign: count,
  shadowRoots: count,
  framesSkipped: count,
  ...timingShape,
});

const viewportSchema = z.object({ width: px, height: px });

export const scanResultSchema = z.object({
  issues: z.array(issueSchema),
  stats: scanStatsSchema,
  viewport: viewportSchema,
});

export const stressOptionsSchema = z.object({
  strategy: z.enum(STRESS_STRATEGIES),
  intensity: z.enum(STRESS_INTENSITIES),
  language: z.enum(SAMPLE_LANGUAGES),
  rtl: z.boolean(),
});

const stressStatsSchema = z.object({
  strings: count,
  textNodes: count,
  placeholders: count,
  buttonValues: count,
  growth: z.number(),
  ...timingShape,
});

export const stressResultSchema = z.object({
  brokenNow: z.array(issueSchema),
  atRisk: z.array(issueSchema),
  viewport: viewportSchema,
  stats: z.object({
    baseline: scanStatsSchema,
    stress: stressStatsSchema,
    stressed: scanStatsSchema,
    durationMs: ms,
    longestSliceMs: ms,
  }),
});

export const revertResultSchema = z.object({ restored: count, keptPageChanges: count });

export const pageInfoSchema = z.object({
  url: z.string(),
  title: z.string(),
  viewport: viewportSchema,
});

export const fixKeySchema = z.enum(FIX_KEYS);

/** A fix tried on the page for one measurement (plan §3.5). */
const trialSchema = z.object({
  outcome: z.enum(['fixes', 'improves', 'no-change']),
  /** CSS pixels that still don't fit, per axis. */
  remaining: z.object({ x: px, y: px }),
  /** How the box changes size with the fix. */
  change: z.object({ width: px, height: px }),
});

export const fixTrialsSchema = z.object({
  trials: z.array(z.object({ key: fixKeySchema, trial: trialSchema })),
  /** Fixes the trials showed are needed too (e.g. the height a wrapped label needs). */
  added: z.array(z.object({ key: fixKeySchema, css: z.string(), element: elementRefSchema })),
  /** Every CSS fix at once, when no single one fixes it. */
  combined: z.nullable(trialSchema),
});

/** What the picked element does with a text tried in it (Inspect's slider and presets). */
export const textTrialSchema = z.object({
  length: count,
  fits: z.boolean(),
  breaksAs: z.nullable(findingKindSchema),
  overflow: z.object({ x: px, y: px }),
});

export const pickedElementSchema = z.object({
  element: elementRefSchema,
  size: viewportSchema,
  text: z.string(),
  breakingPoint: z.nullable(
    z.object({
      length: count,
      fitsUpTo: z.nullable(count),
      maxTested: count,
      needs: z.object({ realistic: count, worst: count }),
      verdict: z.enum(['fits', 'at-risk', 'will-break', 'broken']),
      breaksAs: z.nullable(findingKindSchema),
    }),
  ),
});

// ── Panel → page requests ───────────────────────────────────────────────────

const id = z.number().check(z.int(), z.nonnegative());

export const pageRequestSchema = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('hello') }),
  z.object({ id, type: z.literal('scan'), includeInputs: z.boolean() }),
  z.object({
    id,
    type: z.literal('stress'),
    options: stressOptionsSchema,
    /** `picked`: only the element last chosen with the picker. */
    scope: z.enum(['page', 'picked']),
    includeInputs: z.boolean(),
  }),
  /** Stops the scan or stress test in progress; it fails with code `cancelled`. */
  z.object({ id, type: z.literal('cancel') }),
  z.object({ id, type: z.literal('revert') }),
  z.object({ id, type: z.literal('reapply') }),
  z.object({ id, type: z.literal('highlight'), findingId: z.nullable(z.string()) }),
  z.object({ id, type: z.literal('reveal'), findingId: z.string() }),
  /** The selector and cut of one finding, for places that didn't arrive with them. */
  z.object({ id, type: z.literal('details'), findingId: z.string() }),
  z.object({ id, type: z.literal('pick'), active: z.boolean() }),
  /**
   * Puts a text in the picked element and measures it: a length (grown or
   * shortened from its own text) or a given text. It stays on the page until
   * the next try, `null`, another pick, or other work.
   */
  z.object({
    id,
    type: z.literal('tryText'),
    value: z.nullable(
      z.union([
        z.object({ length: count.check(z.maximum(5000)) }),
        z.object({ text: z.string().check(z.maxLength(5000)) }),
      ]),
    ),
  }),
  /** Scrolls a finding into view for a screenshot and says where it is in the window. */
  z.object({ id, type: z.literal('frame'), findingId: z.string() }),
  /** Tries each suggested fix for one measurement, then restores the page exactly. */
  z.object({ id, type: z.literal('fixes'), findingId: z.string() }),
  /**
   * Keeps one fix (or all of them) applied so it can be seen on the page, until
   * the next preview, a scan or stress test, or the session ends. `null` stops it.
   */
  z.object({
    id,
    type: z.literal('preview'),
    findingId: z.string(),
    key: z.nullable(z.union([fixKeySchema, z.literal('all')])),
  }),
]);

/** What each request resolves to. */
export const pageResultSchemas = {
  hello: pageInfoSchema,
  scan: scanResultSchema,
  stress: stressResultSchema,
  revert: revertResultSchema,
  reapply: z.object({ strings: count }),
  cancel: z.null(),
  highlight: z.null(),
  reveal: z.null(),
  details: z.nullable(
    z.object({
      selector: z.string(),
      cut: z.nullable(z.object({ visible: z.string(), hidden: z.string() })),
    }),
  ),
  pick: z.null(),
  fixes: z.nullable(fixTrialsSchema),
  tryText: z.nullable(textTrialSchema),
  frame: z.nullable(
    z.object({
      /** The finding's box, its text and its container, in CSS pixels from the window's corner. */
      rect: z.object({ x: px, y: px, width: px, height: px }),
      /** The window's size in CSS pixels, scrollbars included, as a capture of it shows. */
      viewport: viewportSchema,
    }),
  ),
  preview: z.null(),
} as const;

export const progressPhaseSchema = z.enum(['scan', 'baseline', 'apply', 'stressed']);

// ── Page → panel messages ───────────────────────────────────────────────────

export const pageMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('result'), id, result: z.unknown() }),
  z.object({
    type: z.literal('error'),
    id,
    message: z.string(),
    code: z.optional(z.enum(['cancelled'])),
  }),
  /** Work in progress: text nodes measured so far in the current phase. */
  z.object({ type: z.literal('progress'), phase: progressPhaseSchema, textNodes: count }),
  /** Strings the page re-rendered or added since stress was applied. */
  z.object({ type: z.literal('pending'), count }),
  /** Stress was reverted on the page itself (the overlay's Revert button). */
  z.object({ type: z.literal('reverted'), result: revertResultSchema }),
  z.object({ type: z.literal('picked'), picked: pickedElementSchema }),
  /** The page changed route without loading (single-page apps); results describe the old one. */
  z.object({ type: z.literal('navigated') }),
  z.object({ type: z.literal('pick-cancelled') }),
]);

// ── Service worker → panel ──────────────────────────────────────────────────

/**
 * The user clicked the toolbar button, pressed the shortcut, or used the
 * context menu on a tab. Each grants temporary access to that tab (activeTab).
 */
export const gestureMessageSchema = z.object({
  type: z.literal('gesture'),
  tabId: count,
  /** Opened from the context menu ("Measure this element"): start the element picker. */
  inspect: z.boolean(),
  at: ms,
});

export { LAST_GESTURE_KEY } from './keys';

// ── Types ───────────────────────────────────────────────────────────────────

export type ElementRef = z.infer<typeof elementRefSchema>;
export type TextCutDto = NonNullable<z.infer<typeof findingSchema>['cut']>;
export type FindingDto = z.infer<typeof findingSchema>;
export type IssueDto = z.infer<typeof issueSchema>;
export type ScanResultDto = z.infer<typeof scanResultSchema>;
export type StressOptionsDto = z.infer<typeof stressOptionsSchema>;
export type StressResultDto = z.infer<typeof stressResultSchema>;
export type RevertResultDto = z.infer<typeof revertResultSchema>;
export type PageInfo = z.infer<typeof pageInfoSchema>;
export type PickedElement = z.infer<typeof pickedElementSchema>;
export type FixTrialsDto = z.infer<typeof fixTrialsSchema>;
export type TextTrialDto = z.infer<typeof textTrialSchema>;
export type TextValueDto = NonNullable<RequestParams<'tryText'>['value']>;
export type TrialDto = FixTrialsDto['trials'][number]['trial'];
export type PreviewKey = NonNullable<RequestParams<'preview'>['key']>;
export type PageRequest = z.infer<typeof pageRequestSchema>;
export type ProgressPhase = z.infer<typeof progressPhaseSchema>;
export type PageRequestType = PageRequest['type'];
export type PageMessage = z.infer<typeof pageMessageSchema>;
export type GestureMessage = z.infer<typeof gestureMessageSchema>;

/** The parameters of a request, without its id and type. */
export type RequestParams<T extends PageRequestType> = Omit<
  Extract<PageRequest, { type: T }>,
  'id' | 'type'
>;
export type ResultOf<T extends PageRequestType> = z.infer<(typeof pageResultSchemas)[T]>;
