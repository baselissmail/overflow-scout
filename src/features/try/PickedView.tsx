import { i18n } from '#i18n';
import { CircleAlert, CircleCheck, MousePointerClick } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { PickedElement } from '@/messaging/protocol';
import { Button } from '@/ui/Button';
import { StepHeader } from '@/ui/StepHeader';

import type { TextTrialProps } from './TextTrial';
import { TextTrial } from './TextTrial';

type Verdict = NonNullable<PickedElement['breakingPoint']>['verdict'];

const ICON = { size: 16, strokeWidth: 1.5 } as const;

function verdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case 'fits':
      return i18n.t('inspect.verdict.fits');
    case 'at-risk':
      return i18n.t('inspect.verdict.atRisk');
    case 'will-break':
      return i18n.t('inspect.verdict.willBreak');
    case 'broken':
      return i18n.t('inspect.verdict.broken');
  }
}

interface PickedViewProps {
  picked: PickedElement;
  onBack: () => void;
  onPickAnother: () => void;
  /** Must keep its identity: a new function would put the tried text back. */
  onTryText: TextTrialProps['onTry'];
  /** The picked element's whole text, to start editing from. Keep its identity stable. */
  onTextOf: () => Promise<string | null>;
}

/**
 * One element the user picked on the page: how much text it holds, against
 * what a translation needs, and a field to put any text in it, live.
 */
export function PickedView({
  picked,
  onBack,
  onPickAnother,
  onTryText,
  onTextOf,
}: PickedViewProps) {
  const point = picked.breakingPoint;
  // The whole text, not the shortened one the pick reported; null until it arrives.
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    void onTextOf().then((value) => {
      if (current) setText(value ?? picked.text);
    });
    return () => {
      current = false;
    };
  }, [onTextOf, picked.text]);

  const fitsNow = point?.verdict === 'fits';
  return (
    <section className="flex animate-enter flex-col gap-5" aria-label={i18n.t('try.heading')}>
      <StepHeader backLabel={i18n.t('actions.back')} onBack={onBack} />

      <div className="flex flex-col gap-1">
        <h2 className="text-title font-semibold">{i18n.t('try.heading')}</h2>
        <p className="text-fg-muted">{i18n.t('try.hint')}</p>
      </div>

      {point ? (
        <div className="flex flex-col gap-1 rounded-card bg-raised p-4 shadow-raised">
          <p className="line-clamp-3 text-specimen break-words" title={picked.text}>
            {picked.text}
          </p>
          <p className="mt-2 flex items-start gap-2 font-medium">
            <span aria-hidden="true" className="mt-0.5 shrink-0">
              {fitsNow ? (
                <CircleCheck {...ICON} className="text-ok" />
              ) : (
                <CircleAlert
                  {...ICON}
                  className={point.verdict === 'at-risk' ? 'text-warning' : 'text-critical'}
                />
              )}
            </span>
            {verdictLabel(point.verdict)}
          </p>
          <p className="text-small text-fg-muted tabular-nums">
            {point.fitsUpTo === null
              ? i18n.t('inspect.fitsAll', [String(point.maxTested)])
              : i18n.t('inspect.fitsUpTo', [String(point.fitsUpTo), String(point.length)])}{' '}
            {point.translatable
              ? i18n.t('inspect.needs', [String(point.needs.realistic), String(point.needs.worst)])
              : i18n.t('inspect.untranslated')}
          </p>
        </div>
      ) : (
        <p className="text-fg-muted">{i18n.t('inspect.noText')}</p>
      )}

      {point && text !== null && <TextTrial initialText={text} onTry={onTryText} focusOnOpen />}

      <Button className="self-start" icon={<MousePointerClick {...ICON} />} onClick={onPickAnother}>
        {i18n.t('inspect.pickAnother')}
      </Button>
    </section>
  );
}
