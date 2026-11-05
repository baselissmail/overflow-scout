import type { FindingDto } from '@/messaging/protocol';

/** Plain-language advice for one cause; the text lives in en.yml under `advice.*`. */
export type AdviceKey =
  | 'whiteSpace'
  | 'overflowWrap'
  | 'lineClamp'
  | 'textOverflow'
  | 'maxWidth'
  | 'minWidth'
  | 'height'
  | 'maxHeight'
  | 'width'
  | 'flex'
  | 'grid'
  | 'pageWidth'
  | 'field'
  | 'overflow';

export interface Advice {
  key: AdviceKey;
  /** A CSS change to try, or null when the fix isn't a one-line CSS change. */
  css: string | null;
  /** Where to apply it: the element label from the diagnosis. */
  element: string;
}

/** Most direct fixes first; hiding overflow is a symptom, so it comes last. */
const ORDER: readonly AdviceKey[] = [
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
];

type Cause = FindingDto['diagnosis']['causes'][number];

function adviceFor(cause: Cause, finding: FindingDto): Omit<Advice, 'element'> | null {
  const field = finding.mechanism === 'placeholder' || finding.mechanism === 'value';
  switch (cause.property) {
    case 'white-space':
      return { key: 'whiteSpace', css: 'white-space: normal;' };
    case 'overflow-wrap':
      return { key: 'overflowWrap', css: 'overflow-wrap: anywhere;' };
    case '-webkit-line-clamp':
      return { key: 'lineClamp', css: '-webkit-line-clamp: unset;' };
    case 'text-overflow':
      return { key: 'textOverflow', css: null };
    case 'max-width':
      return { key: 'maxWidth', css: 'max-width: none;' };
    case 'min-width':
      return { key: 'minWidth', css: 'min-width: 0;' };
    case 'height':
      return { key: 'height', css: `height: auto;\nmin-height: ${cause.value};` };
    case 'max-height':
      return { key: 'maxHeight', css: 'max-height: none;' };
    case 'width':
      if (field) return { key: 'field', css: null };
      if (finding.mechanism === 'page-overflow')
        return { key: 'pageWidth', css: 'max-width: 100%;' };
      return { key: 'width', css: 'width: auto;' };
    case 'flex':
      return { key: 'flex', css: 'min-width: 0;\nflex: 1 1 auto;' };
    case 'grid-column':
      return { key: 'grid', css: null };
    case 'overflow-x':
    case 'overflow-y':
      return { key: 'overflow', css: null };
    default:
      return null;
  }
}

/** What to do about a finding, one item per distinct kind of fix, most direct first. */
export function adviseFor(finding: FindingDto): Advice[] {
  const byKey = new Map<AdviceKey, Advice>();
  for (const cause of finding.diagnosis.causes) {
    const advice = adviceFor(cause, finding);
    if (advice && !byKey.has(advice.key))
      byKey.set(advice.key, { ...advice, element: cause.element.label });
  }
  return [...byKey.values()].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
}
