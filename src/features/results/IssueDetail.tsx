import { i18n } from '#i18n';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { FindingDto, IssueDto, ResultOf } from '@/messaging/protocol';
import { Button } from '@/ui/Button';
import { Badge, TONE_TEXT } from '@/ui/Chip';
import { CutText } from '@/ui/CutText';
import { IconButton } from '@/ui/IconButton';
import { MeasureBar } from '@/ui/MeasureBar';

import { KindIcon, SEVERITY_TONE, formatPx, kindLabel, severityLabel } from './labels';

type Details = ResultOf<'details'>;

export interface IssueDetailProps {
  issue: IssueDto;
  viewport: { width: number; height: number };
  /** Shown only when the detail replaces the list (narrow panels). */
  onBack: (() => void) | null;
  onReveal: (findingId: string) => void;
  onHighlight: (findingId: string | null) => void;
  loadDetails: (findingId: string) => Promise<Details>;
}

const ICON = { size: 16, strokeWidth: 1.5 } as const;

/** What the box offers and what the text needs, on the axis that overflows. */
function measurement(finding: FindingDto, viewport: { width: number }) {
  if (finding.kind === 'page-scroll') {
    return { has: viewport.width, needs: viewport.width + finding.overflow.x, axis: 'x' as const };
  }
  const axis = finding.overflow.x > 0 ? 'x' : 'y';
  const has = axis === 'x' ? finding.box.width : finding.box.height;
  return { has, needs: has + finding.overflow[axis], axis };
}

function useCopied(): [boolean, () => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 1200);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);
  return [
    copied,
    () => {
      setCopied(true);
    },
  ];
}

export function IssueDetail({
  issue,
  viewport,
  onBack,
  onReveal,
  onHighlight,
  loadDetails,
}: IssueDetailProps) {
  const [index, setIndex] = useState(0);
  const finding = issue.instances[Math.min(index, issue.instances.length - 1)];
  // Only the first place of an issue arrives with its selector and cut; others load on demand.
  const [loaded, setLoaded] = useState<{ id: string; details: Details } | null>(null);
  const details = loaded?.id === finding?.id ? loaded?.details : undefined;
  const selector = finding?.element.selector ?? details?.selector ?? null;
  const cut = finding?.cut !== undefined ? finding.cut : (details?.cut ?? null);
  const [copied, markCopied] = useCopied();

  useEffect(() => {
    if (!finding) return;
    // Keep the element outlined on the page while its details are open.
    onHighlight(finding.id);
    if (finding.element.selector && finding.cut !== undefined) return;
    let current = true;
    void loadDetails(finding.id).then((value) => {
      if (current) setLoaded({ id: finding.id, details: value });
    });
    return () => {
      current = false;
    };
  }, [finding, loadDetails, onHighlight]);

  if (!finding) return null;
  const tone = SEVERITY_TONE[issue.severity];
  const { has, needs, axis } = measurement(finding, viewport);
  const short = needs - has;
  const places = issue.instances.length;
  const go = (next: number) => {
    const target = issue.instances[next];
    if (!target) return;
    setIndex(next);
    onReveal(target.id);
  };

  return (
    <article className="flex min-w-0 flex-col gap-4" aria-label={kindLabel(issue.kind)}>
      <header className="flex flex-wrap items-center gap-2">
        {onBack && (
          <IconButton
            label={i18n.t('actions.back')}
            icon={<ArrowLeft {...ICON} className="rtl:rotate-180" />}
            onClick={onBack}
          />
        )}
        <Badge tone={tone} icon={<KindIcon kind={issue.kind} />}>
          {kindLabel(issue.kind)}
        </Badge>
        <span className={`text-small ${TONE_TEXT[tone]}`}>{severityLabel(issue.severity)}</span>
        {places > 1 && (
          <span className="ms-auto flex items-center gap-1">
            <IconButton
              label={i18n.t('actions.previous')}
              icon={<ChevronLeft {...ICON} className="rtl:rotate-180" />}
              disabled={index === 0}
              onClick={() => {
                go(index - 1);
              }}
            />
            <span className="text-small text-fg-muted tabular-nums" aria-live="polite">
              {i18n.t('detail.place', [String(index + 1), String(places)])}
            </span>
            <IconButton
              label={i18n.t('actions.next')}
              icon={<ChevronRight {...ICON} className="rtl:rotate-180" />}
              disabled={index === places - 1}
              onClick={() => {
                go(index + 1);
              }}
            />
          </span>
        )}
      </header>

      {/* The proof: the text cut where readers lose it, measured underneath. */}
      <section
        className="flex flex-col gap-4 rounded-card bg-raised p-3 shadow-raised"
        aria-label={i18n.t('detail.proof')}
      >
        {cut ? (
          <p className="text-title leading-snug">
            <CutText
              visible={cut.visible}
              hidden={cut.hidden}
              visibleLabel={i18n.t('detail.visible')}
              hiddenLabel={
                finding.kind === 'spilling' ? i18n.t('detail.spills') : i18n.t('detail.lost')
              }
              toneClass={TONE_TEXT[tone]}
            />
          </p>
        ) : (
          finding.text !== '' && (
            <p className="text-title leading-snug break-words">{finding.text}</p>
          )
        )}
        <MeasureBar
          key={finding.id}
          has={has}
          needs={needs}
          tone={tone}
          hasLabel={i18n.t('detail.has', [formatPx(has)])}
          needsLabel={i18n.t('detail.needs', [formatPx(needs)])}
          differenceLabel={i18n.t('detail.short', [formatPx(short)])}
          description={i18n.t(axis === 'x' ? 'detail.measure' : 'detail.measureY', [
            formatPx(needs),
            formatPx(has),
            formatPx(short),
          ])}
        />
      </section>

      {finding.before && (
        <section className="flex flex-col gap-1">
          <h2 className="text-small text-fg-muted">{i18n.t('detail.before')}</h2>
          <p className="break-words">{finding.before}</p>
          {finding.growth ? (
            <p className="text-small text-fg-muted tabular-nums">
              {i18n.t('detail.growth', [String(finding.growth)])}
            </p>
          ) : null}
        </section>
      )}

      <section className="flex flex-col gap-1">
        <h2 className="text-small text-fg-muted">{i18n.t('detail.selector')}</h2>
        <div className="flex items-start justify-between gap-2">
          <code className="min-w-0 font-mono text-small break-all" translate="no">
            {selector ?? finding.element.label}
          </code>
          <IconButton
            label={copied ? i18n.t('actions.copied') : i18n.t('actions.copySelector')}
            icon={copied ? <Check {...ICON} className="text-ok" /> : <Copy {...ICON} />}
            disabled={!selector}
            onClick={() => {
              if (!selector) return;
              void navigator.clipboard.writeText(selector).then(markCopied);
            }}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium">{i18n.t('detail.cause')}</span>
          <span className="text-small text-fg-muted">
            {finding.diagnosis.confidence === 'high'
              ? i18n.t('detail.confidenceHigh')
              : i18n.t('detail.confidenceMedium')}
          </span>
        </h2>
        {finding.diagnosis.causes.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card bg-raised shadow-raised">
            {finding.diagnosis.causes.map((cause) => (
              <li
                key={`${cause.property}|${cause.value}|${cause.element.label}`}
                className="flex flex-col gap-1 p-2.5"
              >
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <code
                    className="rounded-[4px] bg-surface px-1 font-mono text-small"
                    translate="no"
                  >
                    {cause.property}: {cause.value}
                  </code>
                  <span className="font-mono text-small break-all text-fg-muted" translate="no">
                    {cause.element.label}
                  </span>
                </span>
                <span>{cause.note}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg-muted">{i18n.t('detail.noCause')}</p>
        )}
      </section>

      <footer className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon={<LocateFixed {...ICON} />}
          onClick={() => {
            onReveal(finding.id);
          }}
        >
          {i18n.t('actions.jump')}
        </Button>
      </footer>
    </article>
  );
}
