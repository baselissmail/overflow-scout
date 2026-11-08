import { i18n } from '#i18n';

import type { IssueDto } from '@/messaging/protocol';
import type { Tone } from '@/ui/Chip';

export type Kind = IssueDto['kind'];
export type Severity = IssueDto['severity'];

export function kindLabel(kind: Kind): string {
  switch (kind) {
    case 'hidden':
      return i18n.t('kind.hidden');
    case 'page-scroll':
      return i18n.t('kind.pageScroll');
    case 'truncated':
      return i18n.t('kind.truncated');
    case 'spilling':
      return i18n.t('kind.spilling');
    case 'input':
      return i18n.t('kind.input');
  }
}

/** One plain sentence on what the problem is, for tooltips and the detail view. */
export function kindDescription(kind: Kind): string {
  switch (kind) {
    case 'hidden':
      return i18n.t('kindDescription.hidden');
    case 'page-scroll':
      return i18n.t('kindDescription.pageScroll');
    case 'truncated':
      return i18n.t('kindDescription.truncated');
    case 'spilling':
      return i18n.t('kindDescription.spilling');
    case 'input':
      return i18n.t('kindDescription.input');
  }
}

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return i18n.t('severity.critical');
    case 'warning':
      return i18n.t('severity.warning');
    case 'notice':
      return i18n.t('severity.notice');
  }
}

export const SEVERITY_TONE: Readonly<Record<Severity, Tone>> = {
  critical: 'critical',
  warning: 'warning',
  notice: 'notice',
};

const integer = new Intl.NumberFormat();
const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function formatCount(value: number): string {
  return integer.format(value);
}

/** A non-breaking space, so a unit never wraps away from its number. */
export const NBSP = '\u00a0';

/** "94 px", kept on one line. */
export function formatPx(value: number): string {
  return `${decimal.format(Math.round(value * 10) / 10)}${NBSP}px`;
}
