import { i18n } from '#i18n';
import { CircleAlert, CircleCheck, CircleMinus, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { FixKey } from '@/core';
import { fixCss, fixesFor } from '@/core';
import type { FindingDto, FixTrialsDto, PreviewKey, TrialDto } from '@/messaging/protocol';
import { Button } from '@/ui/Button';

import { CopyButton } from './CopyButton';
import { formatPx } from './labels';

export interface FixesProps {
  finding: FindingDto;
  /** Tries each fix on the page; null when the page can't be reached. */
  loadFixes: (findingId: string) => Promise<FixTrialsDto | null>;
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

const ICON = { size: 14, strokeWidth: 1.5 } as const;

function adviceText(key: FixKey): string {
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
function sizeChange(change: TrialDto['change']): string {
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

/** What a trial showed, as icon + words (never color alone). */
function Verdict({ trial, together = false }: { trial: TrialDto; together?: boolean }) {
  const still = Math.max(trial.remaining.x, trial.remaining.y);
  const [icon, text] =
    trial.outcome === 'fixes'
      ? [
          <CircleCheck key="icon" {...ICON} className="text-ok" />,
          `${together ? i18n.t('fix.togetherFixes') : i18n.t('fix.fixes')} ${sizeChange(trial.change)}`,
        ]
      : trial.outcome === 'improves'
        ? [
            <CircleAlert key="icon" {...ICON} className="text-warning" />,
            together
              ? i18n.t('fix.togetherImproves', [formatPx(still)])
              : i18n.t('fix.improves', [formatPx(still)]),
          ]
        : [
            <CircleMinus key="icon" {...ICON} className="text-fg-muted" />,
            together ? i18n.t('fix.togetherNoChange') : i18n.t('fix.noChange'),
          ];
  return (
    <p className="flex items-start gap-1.5 text-small">
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {icon}
      </span>
      <span>{text}</span>
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
      className="self-start"
      aria-pressed={active}
      icon={active ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
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
 * what happened when the page tried it. Trials run when a finding opens; a
 * preview keeps one fix on the page until it's stopped or the details close.
 */
export function Fixes({ finding, loadFixes, onPreview }: FixesProps) {
  const [loaded, setLoaded] = useState<{ id: string; result: FixTrialsDto | null } | null>(null);
  const [previewing, setPreviewing] = useState<{ id: string; key: PreviewKey } | null>(null);
  // undefined while the trials run; null when they couldn't.
  const result = loaded?.id === finding.id ? loaded.result : undefined;
  const active = previewing?.id === finding.id ? previewing.key : null;

  useEffect(() => {
    let current = true;
    void loadFixes(finding.id).then((value) => {
      if (current) setLoaded({ id: finding.id, result: value });
    });
    return () => {
      current = false;
      // Leaving this finding (or closing the details) takes any preview off the page.
      void onPreview(finding.id, null);
    };
  }, [finding.id, loadFixes, onPreview]);

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
      <h2 className="font-medium">{i18n.t('detail.whatToDo')}</h2>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card bg-raised shadow-raised">
        {items.map((item) => (
          <li key={item.key} className="flex flex-col gap-1.5 p-2.5">
            {item.added && (
              <span className="text-small text-fg-muted">{i18n.t('fix.addedNote')}</span>
            )}
            <span>{adviceText(item.key)}</span>
            {item.css && (
              <span className="flex items-start justify-between gap-2">
                <code
                  className="min-w-0 rounded-[4px] bg-surface px-1.5 py-1 font-mono text-small break-all whitespace-pre-wrap"
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
          <li className="flex flex-col gap-1.5 p-2.5">
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
