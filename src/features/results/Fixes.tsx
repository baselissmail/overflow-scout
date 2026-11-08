import { i18n } from '#i18n';
import { CircleAlert, CircleCheck, CircleMinus, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { FixKey } from '@/core';
import { fixCss, fixesFor } from '@/core';
import type { FindingDto, FixTrialsDto, PreviewKey, TrialDto } from '@/messaging/protocol';
import { Button } from '@/ui/Button';

import { CopyButton } from './CopyButton';
import { adviceText, verdictText } from './fix-text';

export interface FixesProps {
  finding: FindingDto;
  /** The trials: undefined while they run, null when they couldn't. */
  result: FixTrialsDto | null | undefined;
  /** Keeps a fix applied on the page (null stops it); resolves false if it couldn't. */
  onPreview: (findingId: string, key: PreviewKey | null) => Promise<boolean>;
}

interface Item {
  key: FixKey;
  css: string | null;
  element: string;
  /** Found by the trials, not by the diagnosis. */
  added: boolean;
  trial: TrialDto | undefined;
}

const ICON = { size: 16, strokeWidth: 1.5 } as const;

/** What a trial showed, as icon + words (never color alone). */
function Verdict({ trial, together = false }: { trial: TrialDto; together?: boolean }) {
  const icon =
    trial.outcome === 'fixes' ? (
      <CircleCheck {...ICON} className="text-ok" />
    ) : trial.outcome === 'improves' ? (
      <CircleAlert {...ICON} className="text-warning" />
    ) : (
      <CircleMinus {...ICON} className="text-fg-muted" />
    );
  return (
    <p className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {icon}
      </span>
      <span>{verdictText(trial, together)}</span>
    </p>
  );
}

function PreviewButton({
  active,
  all = false,
  onToggle,
}: {
  active: boolean;
  all?: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="-ms-2 self-start aria-pressed:bg-accent-soft"
      aria-pressed={active}
      icon={active ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
      onClick={onToggle}
    >
      {active
        ? i18n.t('actions.stopPreview')
        : all
          ? i18n.t('actions.previewAll')
          : i18n.t('actions.preview')}
    </Button>
  );
}

/**
 * What to do, verified (plan §3.5): each fix with its CSS, where it goes, and
 * what happened when the page tried it. A preview keeps one fix on the page
 * until it's stopped or the details close.
 */
export function Fixes({ finding, result, onPreview }: FixesProps) {
  const [previewing, setPreviewing] = useState<{ id: string; key: PreviewKey } | null>(null);
  const active = previewing?.id === finding.id ? previewing.key : null;

  useEffect(
    () => () => {
      // Leaving this finding (or closing the details) takes any preview off the page.
      void onPreview(finding.id, null);
    },
    [finding.id, onPreview],
  );

  const items: Item[] = [
    ...fixesFor(finding).map((fix) => ({
      key: fix.key,
      css: fixCss(fix),
      element: fix.element.label,
      added: false,
      trial: result?.trials.find((entry) => entry.key === fix.key)?.trial,
    })),
    ...(result?.added ?? []).map((fix) => ({
      key: fix.key,
      css: fix.css,
      element: fix.element.label,
      added: true,
      trial: undefined,
    })),
  ];
  if (items.length === 0) return null;

  const toggle = (key: PreviewKey) => {
    const next = active === key ? null : key;
    void onPreview(finding.id, next).then((ok) => {
      setPreviewing(ok && next !== null ? { id: finding.id, key: next } : null);
    });
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title font-semibold">{i18n.t('detail.fix')}</h2>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card bg-raised shadow-raised">
        {items.map((item) => (
          <li key={item.key} className="flex flex-col gap-2 p-3">
            {item.added && (
              <span className="text-small text-fg-muted">{i18n.t('fix.addedNote')}</span>
            )}
            <span>{adviceText(item.key)}</span>
            {item.css && (
              <span className="flex items-start gap-1 rounded-control bg-surface ps-3">
                <code
                  className="min-w-0 flex-1 py-2 font-mono text-small break-all whitespace-pre-wrap"
                  translate="no"
                >
                  {item.css}
                </code>
                <CopyButton text={item.css} label={i18n.t('actions.copyCss')} />
              </span>
            )}
            <span className="font-mono text-small break-all text-fg-muted" translate="no">
              {i18n.t('detail.on', [item.element])}
            </span>
            {item.trial && <Verdict trial={item.trial} />}
            {item.css && result && (
              <PreviewButton
                active={active === item.key}
                onToggle={() => {
                  toggle(item.key);
                }}
              />
            )}
          </li>
        ))}
        {result?.combined && (
          <li className="flex flex-col gap-2 p-3">
            <Verdict trial={result.combined} together />
            <PreviewButton
              all
              active={active === 'all'}
              onToggle={() => {
                toggle('all');
              }}
            />
          </li>
        )}
      </ul>
      <p className="text-small text-fg-muted" aria-live="polite">
        {result === undefined
          ? i18n.t('detail.trying')
          : result === null
            ? i18n.t('detail.suggestionNote')
            : i18n.t('detail.tried')}
      </p>
    </section>
  );
}
