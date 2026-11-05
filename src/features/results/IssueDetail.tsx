import { i18n } from '#i18n';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { FindingDto, IssueDto } from '@/messaging/protocol';
import { Button } from '@/ui/Button';
import { Badge, TONE_TEXT } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { MeasureBar } from '@/ui/MeasureBar';

import { SEVERITY_TONE, formatPx, kindLabel, severityLabel } from './labels';

export interface IssueDetailProps {
  issue: IssueDto;
  viewport: { width: number; height: number };
  /** Shown only when the detail replaces the list (narrow panels). */
  onBack: (() => void) | null;
  onReveal: (findingId: string) => void;
  onHighlight: (findingId: string | null) => void;
  loadSelector: (findingId: string) => Promise<string | null>;
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
  loadSelector,
}: IssueDetailProps) {
  const [index, setIndex] = useState(0);
  const finding = issue.instances[Math.min(index, issue.instances.length - 1)];
  // Only the first place of an issue arrives with a selector; others load on demand.
  const [loaded, setLoaded] = useState<{ id: string; selector: string | null } | null>(null);
  const selector =
    finding?.element.selector ?? (loaded?.id === finding?.id ? (loaded?.selector ?? null) : null);
  const [copied, markCopied] = useCopied();

  useEffect(() => {
    if (!finding) return;
    // Keep the element outlined on the page while its details are open.
    onHighlight(finding.id);
    if (finding.element.selector) return;
    let current = true;
    void loadSelector(finding.id).then((value) => {
      if (current) setLoaded({ id: finding.id, selector: value });
    });
    return () => {
      current = false;
    };
  }, [finding, loadSelector, onHighlight]);

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
            icon={<ArrowLeft {...ICON} />}
            onClick={onBack}
          />
        )}
        <Badge tone={tone}>{kindLabel(issue.kind)}</Badge>
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

      <section className="flex flex-col gap-1">
        <h2 className="text-small text-fg-muted">{i18n.t('detail.selector')}</h2>
        <p className="font-mono text-small break-all" translate="no">
          {selector ?? finding.element.label}
        </p>
      </section>

      <MeasureBar
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

      <section className="flex flex-col gap-1">
        {finding.before ? (
          <>
            <h2 className="text-small text-fg-muted">{i18n.t('detail.before')}</h2>
            <p className="break-words">{finding.before}</p>
            <h2 className="text-small text-fg-muted">
              {i18n.t('detail.after')}
              {finding.growth ? ` · ${i18n.t('detail.growth', [String(finding.growth)])}` : ''}
            </h2>
            <p className="break-words">{finding.text}</p>
          </>
        ) : (
          finding.text !== '' && (
            <>
              <h2 className="text-small text-fg-muted">{i18n.t('detail.text')}</h2>
              <p className="break-words">{finding.text}</p>
            </>
          )
        )}
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
          <ul className="flex flex-col gap-2">
            {finding.diagnosis.causes.map((cause) => (
              <li
                key={`${cause.property}|${cause.value}|${cause.element.label}`}
                className="flex flex-col gap-0.5 border-s-2 border-line ps-2"
              >
                <code className="font-mono text-small break-all" translate="no">
                  {cause.property}: {cause.value}
                  <span className="text-fg-muted"> · {cause.element.label}</span>
                </code>
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
        <Button
          icon={copied ? <Check {...ICON} /> : <Copy {...ICON} />}
          disabled={!selector}
          onClick={() => {
            if (!selector) return;
            void navigator.clipboard.writeText(selector).then(markCopied);
          }}
        >
          {copied ? i18n.t('actions.copied') : i18n.t('actions.copySelector')}
        </Button>
      </footer>
    </article>
  );
}
