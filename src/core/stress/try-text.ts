import { scanDocument } from '../scan';
import type { Axis, FindingKind, TraversalOptions } from '../types';
import { growableText } from './breaking-point';
import { hasLetters, resizeParts, textLength } from './generate';

/** What happened to an element's layout with a given text. */
export interface TextTrial {
  /** Characters in the text tried. */
  length: number;
  fits: boolean;
  /** The problem the text causes, if it doesn't fit. */
  breaksAs: FindingKind | null;
  /** CSS pixels that don't fit, per axis. */
  overflow: Record<Axis, number>;
}

export interface TextEdit {
  trial: TextTrial;
  /** Puts the original text back, except in nodes the page has changed since. */
  undo: () => void;
}

/** Make the text this long (grown or shortened like the breaking-point search), or use this text. */
export type TextValue = { length: number } | { text: string };

/**
 * Writes text into an element and measures whether it still fits (plan §5.3).
 * The element keeps its text nodes: a length resizes each part in proportion;
 * a given text goes into the first part with letters and the other parts with
 * letters are emptied, so numbers and symbols around the words stay. In text
 * without letters (a count, a price), the given text replaces all of it.
 *
 * The text stays on the page so people can see it, until `undo`. Returns
 * null when the element has no text at all.
 */
export function tryText(
  element: Element,
  value: TextValue,
  options: TraversalOptions & { seed?: number } = {},
): TextEdit | null {
  const nodes = growableText(element, options);
  const originals = nodes.map((node) => node.data);
  const replaced = originals.some(hasLetters) ? hasLetters : (text: string) => text.trim() !== '';
  const first = originals.findIndex(replaced);
  if (first === -1) return null;

  const values =
    'length' in value
      ? resizeParts(originals, Math.max(1, value.length), options.seed ?? 1)
      : originals.map((original, index) =>
          index === first ? value.text : replaced(original) ? '' : original,
        );
  nodes.forEach((node, index) => {
    const next = values[index] ?? '';
    if (node.data !== next) node.data = next;
  });

  const [finding] = scanDocument(element.ownerDocument, {
    root: element,
    ...(options.ignore && { ignore: options.ignore }),
    ...(options.openShadowRoot && { openShadowRoot: options.openShadowRoot }),
  }).findings;

  let undone = false;
  return {
    trial: {
      length: textLength(values),
      fits: finding === undefined,
      breaksAs: finding?.kind ?? null,
      overflow: finding ? finding.overflow : { x: 0, y: 0 },
    },
    undo: () => {
      if (undone) return;
      undone = true;
      nodes.forEach((node, index) => {
        // The page's own changes win, as when stress text is reverted (ADR 0007).
        if (node.data === (values[index] ?? '')) node.data = originals[index] ?? '';
      });
    },
  };
}
