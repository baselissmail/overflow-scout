import { i18n } from '#i18n';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Eye,
  EyeOff,
  LocateFixed,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ReportContext } from '@/features/report/markdown';
import { CaptureNotAllowed } from '@/features/page/controller';
import { downloadBlob, screenshotName } from '@/features/report/export';
import { issueMarkdown } from '@/features/report/markdown';
import type { FixTrialsDto, IssueDto, PreviewKey, ResultOf } from '@/messaging/protocol';
import { Button } from '@/ui/Button';
import { Badge, TONE_TEXT } from '@/ui/Chip';
import { CutText } from '@/ui/CutText';
import { IconButton } from '@/ui/IconButton';
import { MeasureBar } from '@/ui/MeasureBar';
import { useToast } from '@/ui/Toast';

import { CopyButton, useCopied } from './CopyButton';
import { Fixes } from './Fixes';
import { measurement, measurementSentence } from './measure';
import {
  KindIcon,
  SEVERITY_TONE,
  formatPx,
  kindDescription,
  kindLabel,
  severityLabel,
} from './labels';

type Details = ResultOf<'details'>;

export interface IssueDetailProps {
  issue: IssueDto;
  viewport: { width: number; height: number };
  /** Shown only when the detail replaces the list (narrow panels). */
  onBack: (() => void) | null;
  onReveal: (findingId: string) => void;
  onHighlight: (findingId: string | null) => void;
  loadDetails: (findingId: string) => Promise<Details>;
  /** Tries each suggested fix on the page; null when that can't run. */
  loadFixes: (findingId: string) => Promise<FixTrialsDto | null>;
  onPreview: (findingId: string, key: PreviewKey | null) => Promise<boolean>;
  /** Where the results come from; null hides Copy report. */
  report: ReportContext | null;
  /** A PNG of the finding on the page, cropped to it. */
  onScreenshot: (findingId: string) => Promise<Blob>;
  /** Ignored on this site; ignoring needs a site (null on pages without one). */
  ignored: boolean;
  onIgnore: (() => void) | null;
  onUnignore: () => void;
}

const ICON = { size: 16, strokeWidth: 1.5 } as const;

export function IssueDetail({
  issue,
  viewport,
  onBack,
  onReveal,
  onHighlight,
  loadDetails,
  loadFixes,
  onPreview,
  report,
  onScreenshot,
  ignored,
  onIgnore,
  onUnignore,
}: IssueDetailProps) {
  const [copied, markCopied] = useCopied();
  const [shotCopied, markShotCopied] = useCopied();
  const [shooting, setShooting] = useState(false);
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const finding = issue.instances[Math.min(index, issue.instances.length - 1)];
  // Only the first place of an issue arrives with its selector and cut; others load on demand.
  const [loaded, setLoaded] = useState<{ id: string; details: Details } | null>(null);
  const details = loaded?.id === finding?.id ? loaded?.details : undefined;
  const selector = finding?.element.selector ?? details?.selector ?? null;
  const cut = finding?.cut !== undefined ? finding.cut : (details?.cut ?? null);

  // Fix trials for the finding shown: undefined while they run, null when they couldn't.
  const [trials, setTrials] = useState<{ id: string; result: FixTrialsDto | null } | null>(null);
  const fixes = finding && trials?.id === finding.id ? trials.result : undefined;

  useEffect(() => {
    if (!finding) return;
    let current = true;
    void loadFixes(finding.id).then((result) => {
      if (current) setTrials({ id: finding.id, result });
    });
    return () => {
      current = false;
    };
  }, [finding, loadFixes]);

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
  const measured = measurement(finding, viewport);
  const { has, needs, axis } = measured;
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

      <p className="-mt-2 text-pretty text-fg-muted">{kindDescription(issue.kind)}</p>

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
          hasLabel={
            finding.kind === 'page-scroll'
              ? i18n.t('detail.hasWindow', [formatPx(has)])
              : axis === 'x'
                ? i18n.t('detail.hasWidth', [formatPx(has)])
                : i18n.t('detail.hasHeight', [formatPx(has)])
          }
          needsLabel={i18n.t('detail.needs', [formatPx(needs)])}
          differenceLabel={i18n.t('detail.short', [formatPx(short)])}
          description={measurementSentence(measured)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<LocateFixed size={14} strokeWidth={1.5} />}
            onClick={() => {
              onReveal(finding.id);
            }}
          >
            {i18n.t('actions.jump')}
          </Button>
          {report && (
            <Button
              size="sm"
              icon={
                copied ? (
                  <Check size={14} strokeWidth={1.5} className="text-ok" />
                ) : (
                  <ClipboardCopy size={14} strokeWidth={1.5} />
                )
              }
              onClick={() => {
                const markdown = issueMarkdown(
                  issue,
                  { finding, cut, selector, fixes: fixes ?? null },
                  report,
                );
                void navigator.clipboard.writeText(markdown).then(markCopied);
              }}
            >
              {copied ? i18n.t('actions.copied') : i18n.t('actions.copyReport')}
            </Button>
          )}
          <Button
            size="sm"
            disabled={shooting}
            icon={
              shotCopied ? (
                <Check size={14} strokeWidth={1.5} className="text-ok" />
              ) : (
                <Camera size={14} strokeWidth={1.5} />
              )
            }
            onClick={() => {
              setShooting(true);
              const image = onScreenshot(finding.id);
              // The clipboard gets the promise at once, so the click still counts as the gesture.
              navigator.clipboard
                .write([new ClipboardItem({ 'image/png': image })])
                .then(markShotCopied, async () => {
                  // No clipboard (or the capture failed): save the file instead, or say why not.
                  const name = `${screenshotName(report?.url ?? '', finding.element.label)}.png`;
                  const blob = await image;
                  downloadBlob(name, blob);
                  toast(i18n.t('detail.screenshotSaved'));
                })
                .catch((error: unknown) => {
                  toast(
                    error instanceof CaptureNotAllowed
                      ? i18n.t('detail.screenshotNeedsClick')
                      : i18n.t('detail.screenshotFailed', [
                          error instanceof Error ? error.message : String(error),
                        ]),
                  );
                })
                .finally(() => {
                  setShooting(false);
                });
            }}
          >
            {shotCopied ? i18n.t('actions.copied') : i18n.t('actions.copyScreenshot')}
          </Button>
          {ignored ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Eye size={14} strokeWidth={1.5} />}
              onClick={onUnignore}
            >
              {i18n.t('actions.unignore')}
            </Button>
          ) : (
            onIgnore && (
              <Button
                size="sm"
                variant="ghost"
                icon={<EyeOff size={14} strokeWidth={1.5} />}
                onClick={onIgnore}
              >
                {i18n.t('actions.ignore')}
              </Button>
            )
          )}
        </div>
      </section>

      {/* The next step comes first; the evidence follows. */}
      <Fixes finding={finding} result={fixes} onPreview={onPreview} />

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

      <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
        <dt className="text-small text-fg-muted">{i18n.t('detail.element')}</dt>
        <dd className="col-span-2 font-mono text-small break-all" translate="no">
          {finding.element.label}
        </dd>
        <dt className="text-small text-fg-muted">{i18n.t('detail.selector')}</dt>
        <dd className="font-mono text-small break-all" translate="no">
          {selector ?? '…'}
        </dd>
        <dd>{selector && <CopyButton text={selector} label={i18n.t('actions.copySelector')} />}</dd>
      </dl>

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
    </article>
  );
}
