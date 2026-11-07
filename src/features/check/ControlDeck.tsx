import { i18n } from '#i18n';
import { MousePointerClick, ScanText } from 'lucide-react';

import { Button } from '@/ui/Button';
import { Segmented } from '@/ui/Segmented';

import type { TextLength } from './length';
import { TEXT_LENGTHS, lengthHint, lengthLabel } from './length';

const ICON = { size: 16, strokeWidth: 1.5 } as const;

interface ControlDeckProps {
  /** The length the page's text is at (or is going to, while that runs). */
  length: TextLength;
  hasResults: boolean;
  busy: boolean;
  /** No tab to work on. */
  disabled: boolean;
  picking: boolean;
  /** Texts the page changed back while longer text was on. */
  pending: number;
  onCheck: () => void;
  onLength: (length: TextLength) => void;
  onPick: () => void;
  onCancelPick: () => void;
  onReapply: () => void;
}

/**
 * The three things the panel does, always in the same place: check the page,
 * try your own text in one element, and set how long the page's text is.
 * The length control shows the page's state, so going back is the same control.
 */
export function ControlDeck({
  length,
  hasResults,
  busy,
  disabled,
  picking,
  pending,
  onCheck,
  onLength,
  onPick,
  onCancelPick,
  onReapply,
}: ControlDeckProps) {
  const off = busy || disabled;

  if (picking) {
    // Waiting for a click on the page: say so where the eye already is, with the way out.
    return (
      <section
        className="flex animate-enter items-center gap-3 rounded-card bg-accent-soft p-3 shadow-[0_0_0_1px_var(--color-accent)]"
        aria-label={i18n.t('try.heading')}
      >
        <MousePointerClick {...ICON} aria-hidden="true" className="shrink-0 text-accent" />
        <p className="min-w-0 flex-1" role="status">
          {i18n.t('picking.hint')}
        </p>
        <Button size="sm" aria-keyshortcuts="Escape" onClick={onCancelPick}>
          {i18n.t('actions.stopPicking')}
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={<ScanText {...ICON} />} disabled={off} onClick={onCheck}>
          {hasResults ? i18n.t('actions.scanAgain') : i18n.t('actions.scan')}
        </Button>
        <Button icon={<MousePointerClick {...ICON} />} disabled={off} onClick={onPick}>
          {i18n.t('actions.tryText')}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        {/* The group is named by its aria-label; this is the same words, for the eye. */}
        <span aria-hidden="true" className="font-medium">
          {i18n.t('length.label')}
        </span>
        <Segmented<TextLength>
          label={i18n.t('length.label')}
          size="md"
          value={length}
          disabled={off}
          options={TEXT_LENGTHS.map((value) => ({ value, label: lengthLabel(value) }))}
          onChange={onLength}
        />
        <p className="text-small text-pretty text-fg-muted">{lengthHint(length)}</p>
        {pending > 0 && (
          <p
            className="mt-1 flex flex-wrap items-center justify-between gap-2 text-small"
            role="status"
          >
            <span>{i18n.t('page.reset', pending, [String(pending)])}</span>
            <Button size="sm" disabled={busy} onClick={onReapply}>
              {i18n.t('actions.reapply')}
            </Button>
          </p>
        )}
      </div>
    </section>
  );
}
