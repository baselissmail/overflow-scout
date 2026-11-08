import { walkTree } from '../collect';
import { SHOW_TEXT, windowOf } from '../dom';
import { scanDocument } from '../scan';
import type { FindingKind, TraversalOptions } from '../types';
import { translatedLength } from './expansion';
import { isIconFont, isUntouchable } from './filters';
import { hasLetters, resizeParts, textLength } from './generate';

export interface BreakingPointOptions extends TraversalOptions {
  /** Longest text to try, in characters. Default: 4× the current length, and at least 40 more. */
  maxLength?: number;
  /** Seed for the filler text. */
  seed?: number;
}

export type BreakingVerdict = 'fits' | 'at-risk' | 'will-break' | 'broken';

export interface BreakingPoint {
  /** Characters in the element's text now. */
  length: number;
  /** The most characters that fit, or null when even `maxTested` fits. */
  fitsUpTo: number | null;
  maxTested: number;
  /**
   * Characters a translation is expected to need: realistic and worst case (plan §4.1).
   * Text without letters (a count, a price) stays the same, so both are its own length.
   */
  needs: { realistic: number; worst: number };
  /** False for text without letters, which translations leave as it is. */
  translatable: boolean;
  /**
   * - `fits`: room for a worst-case translation.
   * - `at-risk`: room for a realistic translation, not the worst case.
   * - `will-break`: not even room for a realistic translation.
   * - `broken`: the text doesn't fit now.
   */
  verdict: BreakingVerdict;
  /** The problem that appears once the text is too long. */
  breaksAs: FindingKind | null;
  /** Layouts measured during the search. */
  iterations: number;
}

/** Compares the room an element has with what a translation needs. */
export function verdictFor(
  fitsUpTo: number | null,
  needs: { realistic: number; worst: number },
): Exclude<BreakingVerdict, 'broken'> {
  if (fitsUpTo === null || fitsUpTo >= needs.worst) return 'fits';
  return fitsUpTo >= needs.realistic ? 'at-risk' : 'will-break';
}

/** The text nodes of an element that can grow: not in icon fonts or untouchable parts. */
export function growableText(element: Element, options: TraversalOptions = {}): Text[] {
  const doc = element.ownerDocument;
  const view = windowOf(doc);
  return [...walkTree(doc, element, SHOW_TEXT, options, { skip: isUntouchable })].filter(
    (node): node is Text => {
      const host = node.parentElement;
      return host !== null && !isIconFont(view.getComputedStyle(host));
    },
  );
}

/**
 * Finds how many characters fit in an element before its text is cut off or
 * spills (plan §4.3). Binary search on the text length, in place: every trial
 * writes, measures, and the original text is restored before returning, all
 * in one task, so nothing is ever painted.
 *
 * Returns null when the element has no text at all.
 */
export function findBreakingPoint(
  element: Element,
  options: BreakingPointOptions = {},
): BreakingPoint | null {
  const doc = element.ownerDocument;
  const nodes = growableText(element, options);
  const originals = nodes.map((node) => node.data);
  const length = textLength(originals);
  if (length === 0) return null;
  const translatable = originals.some(hasLetters);
  const maxTested = options.maxLength ?? Math.max(length * 4, length + 40);
  const seed = options.seed ?? 1;
  const scanOptions = {
    root: element,
    ...(options.ignore && { ignore: options.ignore }),
    ...(options.openShadowRoot && { openShadowRoot: options.openShadowRoot }),
  };

  let iterations = 0;
  const trial = (target: number): { length: number; kind: FindingKind | null } => {
    iterations += 1;
    const values = resizeParts(originals, target, seed);
    nodes.forEach((node, index) => {
      const value = values[index] ?? '';
      if (node.data !== value) node.data = value;
    });
    const [finding] = scanDocument(doc, scanOptions).findings;
    return { length: textLength(values), kind: finding?.kind ?? null };
  };

  try {
    const needs = translatable
      ? {
          realistic: translatedLength(length, 'realistic'),
          worst: translatedLength(length, 'worst'),
        }
      : { realistic: length, worst: length };
    const now = trial(length);

    if (now.kind) {
      // Already broken: search downward for the longest text that fits.
      let low = 0;
      let high = length - 1;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (trial(middle).kind) high = middle - 1;
        else low = middle;
      }
      return {
        length,
        fitsUpTo: low,
        maxTested,
        needs,
        translatable,
        verdict: 'broken',
        breaksAs: now.kind,
        iterations,
      };
    }

    const longest = trial(maxTested);
    if (!longest.kind) {
      return {
        length,
        fitsUpTo: null,
        maxTested,
        needs,
        translatable,
        verdict: 'fits',
        breaksAs: null,
        iterations,
      };
    }

    let low = length;
    let high = maxTested;
    let breaksAs: FindingKind = longest.kind;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      const result = trial(middle);
      if (result.kind) {
        high = middle;
        breaksAs = result.kind;
      } else {
        low = middle;
      }
    }
    return {
      length,
      fitsUpTo: low,
      maxTested,
      needs,
      translatable,
      verdict: verdictFor(low, needs),
      breaksAs,
      iterations,
    };
  } finally {
    nodes.forEach((node, index) => {
      const original = originals[index] ?? '';
      if (node.data !== original) node.data = original;
    });
  }
}
