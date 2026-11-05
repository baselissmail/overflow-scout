import { i18n } from '#i18n';

import type { FindingDto } from '@/messaging/protocol';

import { formatPx } from './labels';

export interface Measurement {
  /** What the box offers on the axis that overflows (the window, for page scroll). */
  has: number;
  /** What the content needs on that axis. */
  needs: number;
  axis: 'x' | 'y';
}

/** What the box offers and what the text needs, on the axis that overflows. */
export function measurement(finding: FindingDto, viewport: { width: number }): Measurement {
  if (finding.kind === 'page-scroll') {
    return { has: viewport.width, needs: viewport.width + finding.overflow.x, axis: 'x' };
  }
  const axis = finding.overflow.x > 0 ? 'x' : 'y';
  const has = axis === 'x' ? finding.box.width : finding.box.height;
  return { has, needs: has + finding.overflow[axis], axis };
}

/** "Needs 214 px, has 120 px, 94 px short." */
export function measurementSentence({ has, needs, axis }: Measurement): string {
  return i18n.t(axis === 'x' ? 'detail.measure' : 'detail.measureY', [
    formatPx(needs),
    formatPx(has),
    formatPx(needs - has),
  ]);
}
