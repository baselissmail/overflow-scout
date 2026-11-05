import { i18n } from '#i18n';

import type { IssueDto } from '@/messaging/protocol';

type Kind = IssueDto['kind'];
type Severity = IssueDto['severity'];

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

/** Status is always color + text, never color alone (plan §3.3). */
export const SEVERITY_CLASSES: Readonly<Record<Severity, string>> = {
  critical: 'bg-critical-soft text-critical',
  warning: 'bg-warning-soft text-warning',
  notice: 'bg-notice-soft text-notice',
};

const integer = new Intl.NumberFormat();

export function formatCount(value: number): string {
  return integer.format(value);
}
