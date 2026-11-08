import { flatParent, isInput, isRootElement } from '../dom';
import type { LayoutReader } from '../measure/layout';
import { px } from '../measure/layout';
import type { Cause, Diagnosis, FindingKind, Mechanism } from '../types';

/** What the scanner knows about a finding before it is explained. */
export interface DiagnosisInput {
  kind: FindingKind;
  mechanism: Mechanism;
  element: Element;
  container: Element;
  overflow: { x: number; y: number };
  /** Raw text content, used to spot unbreakable words. */
  text: string;
  viewportWidth: number;
}

const round = (value: number) => Math.round(value * 10) / 10;
const pxText = (value: number) => `${String(round(value))}px`;

/** A token this long without a break opportunity usually can't wrap. */
const UNBREAKABLE_TOKEN = /[^\s\-–—/]{24,}/u;

/** Finds the element where an inherited `white-space` value was set. */
function whiteSpaceOrigin(
  layout: LayoutReader,
  from: Element,
  stopAt: Element,
): { element: Element; value: string } | null {
  let origin: Element | null = null;
  let value = '';
  for (let element: Element | null = from; element; element = flatParent(element)) {
    const current = layout.style(element).whiteSpace;
    const parent = flatParent(element);
    const inherited = parent ? layout.style(parent).whiteSpace === current : false;
    if (/^(nowrap|pre)$/.test(current) && !inherited) {
      origin = element;
      value = current;
      break;
    }
    if (element === stopAt || isRootElement(element)) break;
  }
  return origin ? { element: origin, value } : null;
}

function widthCauses(layout: LayoutReader, container: Element, overflow: number): Cause[] {
  const style = layout.style(container);
  const width = layout.rect(container).width;
  const needed = width + overflow;
  if (style.maxWidth !== 'none' && Math.abs(px(style.maxWidth) - width) <= 1) {
    return [
      {
        element: container,
        property: 'max-width',
        value: style.maxWidth,
        note: `max-width caps the box at ${pxText(width)}; the text needs about ${pxText(needed)}.`,
      },
    ];
  }
  const parent = flatParent(container);
  const parentDisplay = parent ? layout.style(parent).display : '';
  if (parentDisplay.includes('flex')) {
    return [
      {
        element: container,
        property: 'flex',
        value: `${style.flexGrow} ${style.flexShrink} ${style.flexBasis}`,
        note: `The flex layout sizes this item to ${pxText(width)}; the text needs about ${pxText(needed)}.`,
      },
    ];
  }
  if (parentDisplay.includes('grid')) {
    return [
      {
        element: container,
        property: 'grid-column',
        value: style.gridColumn,
        note: `The grid track is ${pxText(width)} wide; the text needs about ${pxText(needed)}.`,
      },
    ];
  }
  return [
    {
      element: container,
      property: 'width',
      value: pxText(width),
      note: `The box is ${pxText(width)} wide (set directly or by its parent); the text needs about ${pxText(needed)}.`,
    },
  ];
}

function heightCauses(layout: LayoutReader, container: Element, overflow: number): Cause[] {
  const style = layout.style(container);
  const height = layout.rect(container).height;
  if (style.maxHeight !== 'none' && Math.abs(px(style.maxHeight) - height) <= 1) {
    return [
      {
        element: container,
        property: 'max-height',
        value: style.maxHeight,
        note: `max-height caps the box at ${pxText(height)}; the text needs about ${pxText(height + overflow)}.`,
      },
    ];
  }
  return [
    {
      element: container,
      property: 'height',
      value: pxText(height),
      note: `The box stays ${pxText(height)} tall while the text needs about ${pxText(height + overflow)}.`,
    },
  ];
}

/**
 * Explains a finding with the CSS facts that cause it. Confidence is high only
 * when a single declared property decides the outcome (nowrap, ellipsis,
 * line-clamp, a max-width/max-height that is reached, an unbreakable word).
 */
export function diagnose(layout: LayoutReader, input: DiagnosisInput): Diagnosis {
  const { element, container, overflow, mechanism } = input;
  const causes: Cause[] = [];
  let decisive = false;

  if (mechanism === 'placeholder' || mechanism === 'value') {
    const width = isInput(element) ? element.clientWidth : layout.rect(element).width;
    causes.push({
      element,
      property: 'width',
      value: pxText(width),
      note: `The ${mechanism === 'placeholder' ? 'placeholder' : 'value'} needs about ${pxText(width + overflow.x)} but the field is ${pxText(width)} wide.`,
    });
    return { confidence: 'high', causes };
  }

  if (mechanism === 'page-overflow') {
    const rect = layout.rect(element);
    const style = layout.style(element);
    causes.push({
      element,
      property: 'width',
      value: pxText(rect.width),
      note: `The element is ${pxText(rect.width)} wide and extends ${pxText(overflow.x)} past the ${pxText(input.viewportWidth)} viewport.`,
    });
    if (style.minWidth !== 'auto' && px(style.minWidth) > 0) {
      causes.push({
        element,
        property: 'min-width',
        value: style.minWidth,
        note: 'min-width keeps the element from shrinking to the viewport.',
      });
      decisive = true;
    }
  }

  if (mechanism === 'ellipsis') {
    causes.push({
      element: container,
      property: 'text-overflow',
      value: 'ellipsis',
      note: 'Text that does not fit is replaced by an ellipsis, so readers lose the end of it.',
    });
    decisive = true;
  }

  if (mechanism === 'line-clamp') {
    const style = layout.style(container);
    const lines =
      style.getPropertyValue('-webkit-line-clamp') || style.getPropertyValue('line-clamp');
    causes.push({
      element: container,
      property: '-webkit-line-clamp',
      value: lines,
      note: `Only ${lines} line(s) are shown; the rest of the text is cut.`,
    });
    decisive = true;
  }

  if (overflow.x > 0) {
    const nowrap = whiteSpaceOrigin(layout, element, container);
    if (nowrap) {
      causes.push({
        element: nowrap.element,
        property: 'white-space',
        value: nowrap.value,
        note: 'The text cannot wrap onto another line.',
      });
      decisive = true;
    } else if (UNBREAKABLE_TOKEN.test(input.text)) {
      const style = layout.style(element);
      if (style.overflowWrap === 'normal' && style.wordBreak === 'normal') {
        const token = UNBREAKABLE_TOKEN.exec(input.text)?.[0] ?? '';
        causes.push({
          element,
          property: 'overflow-wrap',
          value: 'normal',
          note: `"${token.slice(0, 32)}${token.length > 32 ? '...' : ''}" has no break opportunity.`,
        });
        decisive = true;
      }
    }
    if (mechanism !== 'page-overflow') causes.push(...widthCauses(layout, container, overflow.x));
  }

  if (overflow.y > 0) {
    causes.push(...heightCauses(layout, container, overflow.y));
  }

  if (mechanism === 'clip' && !isRootElement(container)) {
    const style = layout.style(container);
    const axisValue = overflow.x > 0 ? style.overflowX : style.overflowY;
    causes.push({
      element: container,
      property: overflow.x > 0 ? 'overflow-x' : 'overflow-y',
      value: axisValue,
      note: 'Content outside the box is hidden with no visual cue.',
    });
  }

  return { confidence: decisive ? 'high' : 'medium', causes };
}
