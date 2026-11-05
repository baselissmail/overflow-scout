import { i18n } from '#i18n';

import type { FixKey } from '@/core';
import type { TrialDto } from '@/messaging/protocol';

import { formatPx } from './labels';

/** The advice for a fix, in words. Shared by the details and the report. */
export function adviceText(key: FixKey): string {
  switch (key) {
    case 'whiteSpace':
      return i18n.t('advice.whiteSpace');
    case 'overflowWrap':
      return i18n.t('advice.overflowWrap');
    case 'lineClamp':
      return i18n.t('advice.lineClamp');
    case 'textOverflow':
      return i18n.t('advice.textOverflow');
    case 'maxWidth':
      return i18n.t('advice.maxWidth');
    case 'minWidth':
      return i18n.t('advice.minWidth');
    case 'height':
      return i18n.t('advice.height');
    case 'maxHeight':
      return i18n.t('advice.maxHeight');
    case 'width':
      return i18n.t('advice.width');
    case 'flex':
      return i18n.t('advice.flex');
    case 'grid':
      return i18n.t('advice.grid');
    case 'pageWidth':
      return i18n.t('advice.pageWidth');
    case 'field':
      return i18n.t('advice.field');
    case 'overflow':
      return i18n.t('advice.overflow');
  }
}

/** "The box gets 18 px taller." Changes under a pixel aren't worth a sentence. */
export function sizeChange(change: TrialDto['change']): string {
  const parts: string[] = [];
  if (Math.abs(change.width) >= 1) {
    parts.push(
      change.width > 0
        ? i18n.t('fix.wider', [formatPx(change.width)])
        : i18n.t('fix.narrower', [formatPx(-change.width)]),
    );
  }
  if (Math.abs(change.height) >= 1) {
    parts.push(
      change.height > 0
        ? i18n.t('fix.taller', [formatPx(change.height)])
        : i18n.t('fix.shorter', [formatPx(-change.height)]),
    );
  }
  const [first, second] = parts;
  if (first === undefined) return i18n.t('fix.sizeSame');
  return second === undefined
    ? i18n.t('fix.sizeOne', [first])
    : i18n.t('fix.sizeTwo', [first, second]);
}

/** What a trial showed: "Fixes it. The box gets 22 px taller." */
export function verdictText(trial: TrialDto, together = false): string {
  const still = formatPx(Math.max(trial.remaining.x, trial.remaining.y));
  switch (trial.outcome) {
    case 'fixes':
      return `${together ? i18n.t('fix.togetherFixes') : i18n.t('fix.fixes')} ${sizeChange(trial.change)}`;
    case 'improves':
      return together ? i18n.t('fix.togetherImproves', [still]) : i18n.t('fix.improves', [still]);
    case 'no-change':
      return together ? i18n.t('fix.togetherNoChange') : i18n.t('fix.noChange');
  }
}
