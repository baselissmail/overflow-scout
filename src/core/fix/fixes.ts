/**
 * What to do about a finding (plan §3.5): one candidate fix per kind of cause,
 * and trials that apply each fix to the page for one measurement, then put
 * the page back exactly.
 *
 * The rules are generic over the element type so the side panel can show the
 * same advice from serialized findings while the page tries them on real
 * elements.
 */
import { isHtmlElement } from '../dom';
import { scanDocument } from '../scan';
import type { Axis, Finding, Mechanism, TraversalOptions } from '../types';

/** Kinds of fix, most direct first; hiding overflow is a symptom, so it comes last. */
export const FIX_KEYS = [
  'whiteSpace',
  'overflowWrap',
  'lineClamp',
  'textOverflow',
  'maxWidth',
  'minWidth',
  'height',
  'maxHeight',
  'width',
  'flex',
  'grid',
  'pageWidth',
  'field',
  'overflow',
] as const;

/** Plain-language advice for one cause; the side panel words it. */
export type FixKey = (typeof FIX_KEYS)[number];

export interface Fix<E> {
  key: FixKey;
  /** CSS to try, or empty when the fix isn't a CSS change (e.g. shorten the text). */
  declarations: readonly (readonly [property: string, value: string])[];
  /** Where to apply it: the element the cause was found on. */
  element: E;
}

/** The parts of a finding the rules read; satisfied by `Finding` and by its DTO. */
export interface FixSource<E> {
  mechanism: Mechanism;
  diagnosis: { causes: readonly { element: E; property: string; value: string }[] };
}

function declarationsFor(
  property: string,
  value: string,
  mechanism: Mechanism,
): Pick<Fix<unknown>, 'key' | 'declarations'> | null {
  const field = mechanism === 'placeholder' || mechanism === 'value';
  switch (property) {
    case 'white-space':
      return { key: 'whiteSpace', declarations: [['white-space', 'normal']] };
    case 'overflow-wrap':
      return { key: 'overflowWrap', declarations: [['overflow-wrap', 'anywhere']] };
    case '-webkit-line-clamp':
      return { key: 'lineClamp', declarations: [['-webkit-line-clamp', 'unset']] };
    case 'text-overflow':
      return { key: 'textOverflow', declarations: [] };
    case 'max-width':
      return { key: 'maxWidth', declarations: [['max-width', 'none']] };
    case 'min-width':
      return { key: 'minWidth', declarations: [['min-width', '0']] };
    case 'height':
      return {
        key: 'height',
        declarations: [
          ['height', 'auto'],
          ['min-height', value],
        ],
      };
    case 'max-height':
      return { key: 'maxHeight', declarations: [['max-height', 'none']] };
    case 'width':
      if (field) return { key: 'field', declarations: [] };
      if (mechanism === 'page-overflow') {
        return { key: 'pageWidth', declarations: [['max-width', '100%']] };
      }
      return { key: 'width', declarations: [['width', 'auto']] };
    case 'flex':
      return {
        key: 'flex',
        declarations: [
          ['min-width', '0'],
          ['flex', '1 1 auto'],
        ],
      };
    case 'grid-column':
      return { key: 'grid', declarations: [] };
    case 'overflow-x':
    case 'overflow-y':
      return { key: 'overflow', declarations: [] };
    default:
      return null;
  }
}

/** One fix per kind of cause, most direct first. */
export function fixesFor<E>(source: FixSource<E>): Fix<E>[] {
  const byKey = new Map<FixKey, Fix<E>>();
  for (const cause of source.diagnosis.causes) {
    const fix = declarationsFor(cause.property, cause.value, source.mechanism);
    if (fix && !byKey.has(fix.key)) byKey.set(fix.key, { ...fix, element: cause.element });
  }
  return [...byKey.values()].sort((a, b) => FIX_KEYS.indexOf(a.key) - FIX_KEYS.indexOf(b.key));
}

/** The fix as CSS to copy, one declaration per line. */
export function fixCss(fix: Pick<Fix<unknown>, 'declarations'>): string | null {
  if (fix.declarations.length === 0) return null;
  return fix.declarations.map(([property, value]) => `${property}: ${value};`).join('\n');
}

// ── Trials ──────────────────────────────────────────────────────────────────

export type TrialOutcome = 'fixes' | 'improves' | 'no-change';

export interface Trial {
  outcome: TrialOutcome;
  /** CSS pixels that still don't fit, per axis (0 when fixed). */
  remaining: { x: number; y: number };
  /** How the box changes size with the fix, in CSS pixels. */
  change: { width: number; height: number };
}

export interface FixTrials {
  /** One trial per fix that has CSS, keyed by fix. */
  trials: Partial<Record<FixKey, Trial>>;
  /**
   * Fixes the trials showed are needed too, though the diagnosis couldn't see
   * them: wrapping text in a box of fixed height moves the overflow downwards.
   */
  added: Fix<Element>[];
  /** All CSS fixes at once (with `added`), when no single one fixes it and there are at least two. */
  combined: Trial | null;
}

/** An inline style change that can be undone exactly. */
export interface StyleEdit {
  undo: () => void;
}

/**
 * Applies declarations as inline `!important` styles, so they win over the
 * page's rules, with transitions off so the new size is measured at once.
 * `undo` restores the `style` attribute string exactly (or removes it).
 */
export function applyDeclarations(
  edits: readonly { element: Element; declarations: Fix<Element>['declarations'] }[],
  options: { transitions?: boolean } = {},
): StyleEdit {
  const saved = edits.flatMap(({ element }) =>
    isHtmlElement(element) ? [{ element, style: element.getAttribute('style') }] : [],
  );
  for (const { element, declarations } of edits) {
    if (!isHtmlElement(element)) continue;
    if (!options.transitions) element.style.setProperty('transition', 'none', 'important');
    for (const [property, value] of declarations) {
      element.style.setProperty(property, value, 'important');
    }
  }
  let undone = false;
  return {
    undo: () => {
      if (undone) return;
      undone = true;
      for (const { element, style } of saved) {
        // Writing the attribute first matters: Chrome syncs inline styles set through
        // the CSSOM lazily, and removing a stale attribute would leave `style=""`.
        element.setAttribute('style', style ?? '');
        if (style === null) element.removeAttribute('style');
      }
    },
  };
}

const AXES: readonly Axis[] = ['x', 'y'];
/** Changes smaller than this are measurement noise, not an improvement. */
const NOISE = 0.5;

function remainingFor(finding: Finding, options: TraversalOptions): Finding | undefined {
  return scanDocument(finding.element.ownerDocument, {
    ...options,
    root: finding.element,
  }).findings.find((item) => item.element === finding.element);
}

/** The fix for a box whose height now cuts off text that wraps. */
function heightFix(container: Element): Fix<Element> {
  const style = container.ownerDocument.defaultView?.getComputedStyle(container);
  if (style && style.maxHeight !== 'none') {
    return { key: 'maxHeight', declarations: [['max-height', 'none']], element: container };
  }
  return {
    key: 'height',
    declarations: [
      ['height', 'auto'],
      ['min-height', style?.height ?? 'auto'],
    ],
    element: container,
  };
}

function sizeOf(element: Element): { width: number; height: number } {
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Tries each CSS fix on the page and measures whether the finding's text then
 * fits. Every trial writes, measures and restores in the same task, so the
 * page never paints a fix and its own styles end exactly as they were.
 */
export function tryFixes(
  finding: Finding,
  fixes: readonly Fix<Element>[],
  options: TraversalOptions = {},
): FixTrials {
  const box = finding.kind === 'page-scroll' ? finding.element : finding.container;
  const before = sizeOf(box);
  /** Set by a trial whose wrapped text a fixed height now cuts off. */
  const seen: { clipsDown: Element | null } = { clipsDown: null };
  const trial = (edits: readonly Fix<Element>[]): Trial => {
    const edit = applyDeclarations(edits);
    try {
      const after = remainingFor(finding, options);
      const remaining = after ? after.overflow : { x: 0, y: 0 };
      if (after && finding.overflow.y <= NOISE && remaining.y > NOISE)
        seen.clipsDown ??= after.container;
      const size = sizeOf(box);
      const fixed = remaining.x <= NOISE && remaining.y <= NOISE;
      const better = AXES.some((axis) => finding.overflow[axis] - remaining[axis] > NOISE);
      return {
        outcome: fixed ? 'fixes' : better ? 'improves' : 'no-change',
        remaining: { x: round(remaining.x), y: round(remaining.y) },
        change: {
          width: round(size.width - before.width),
          height: round(size.height - before.height),
        },
      };
    } finally {
      edit.undo();
    }
  };

  const withCss = fixes.filter((fix) => fix.declarations.length > 0);
  const trials: Partial<Record<FixKey, Trial>> = {};
  for (const fix of withCss) trials[fix.key] = trial([fix]);
  if (Object.values(trials).some((result) => result.outcome === 'fixes')) {
    return { trials, added: [], combined: null };
  }
  const added: Fix<Element>[] = [];
  const vertical: readonly FixKey[] = ['height', 'maxHeight', 'lineClamp'];
  if (seen.clipsDown && !withCss.some((fix) => vertical.includes(fix.key))) {
    added.push(heightFix(seen.clipsDown));
  }
  const together = [...withCss, ...added];
  return { trials, added, combined: together.length > 1 ? trial(together) : null };
}
