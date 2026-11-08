import { i18n } from '#i18n';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  Eye,
  EyeOff,
  LocateFixed,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { ReportContext } from '@/features/report/markdown';
import { CaptureHidden, CaptureNotAllowed } from '@/features/page/controller';
import { downloadBlob, screenshotName } from '@/features/report/export';
import { issueMarkdown } from '@/features/report/markdown';
import { TextTrial } from '@/features/try/TextTrial';
import type {
  FixTrialsDto,
  IssueDto,
  PreviewKey,
  ResultOf,
  TextTrialDto,
  TextValueDto,
} from '@/messaging/protocol';
import { Button } from '@/ui/Button';
import { TONE_BG, TONE_TEXT } from '@/ui/Chip';
import { CutText } from '@/ui/CutText';
import { IconButton } from '@/ui/IconButton';
import { StepHeader } from '@/ui/StepHeader';
import { cx } from '@/ui/cx';
import { useToast } from '@/ui/Toast';

import { CopyButton, useCopied } from './CopyButton';
import { Fixes } from './Fixes';
import { measurement, measurementSentence } from './measure';
import { SEVERITY_TONE, kindDescription, kindLabel } from './labels';

type Details = ResultOf<'details'>;

export interface IssueDetailProps {
  issue: IssueDto;
  viewport: { width: number; height: number };
  /** It appears only with longer text. */
  fresh: boolean;
  onBack: () => void;
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
  /** Puts a text in a result's element and measures it; null puts its own text back. */
  onTryText: (value: TextValueDto | null, findingId: string) => Promise<TextTrialDto | null>;
  /** The whole text of a result's element, to start editing from. */
  onTextOf: (findingId: string) => Promise<string | null>;
}

const ICON = { size: 16, strokeWidth: 1.5 } as const;
const SMALL = { size: 14, strokeWidth: 1.5 } as const;

/**
 * One problem, in the order it's worked through: what's wrong, the text as
 * readers see it, how to fix it (tested on the page), and a field to try any
 * other text in the same element. The rest (why, where) is folded away.
 */
export function IssueDetail({
  issue,
  viewport,
  fresh,
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
  onTryText,
  onTextOf,
}: IssueDetailProps) {
  const [copied, markCopied] = useCopied();
  const [shotCopied, markShotCopied] = useCopied();
  const [shotSaved, markShotSaved] = useCopied();
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

  // "Try your own text" starts from the element's whole text, per place.
  const [tryText, setTryText] = useState<{ id: string; text: string } | null>(null);
  const findingId = finding?.id;
  // What the element showed when checked, if its whole text can't be read.
  const sample = finding?.text ?? '';
  const tryOnFinding = useCallback(
    (value: TextValueDto | null) =>
      findingId === undefined ? Promise.resolve(null) : onTryText(value, findingId),
    [findingId, onTryText],
  );

  useEffect(() => {
    if (findingId === undefined) return;
    let current = true;
    void onTextOf(findingId).then((text) => {
      if (current) setTryText({ id: findingId, text: text ?? sample });
    });
    return () => {
      current = false;
    };
  }, [findingId, onTextOf, sample]);

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
  const places = issue.instances.length;
  const go = (next: number) => {
    const target = issue.instances[next];
    if (!target) return;
    setIndex(next);
    onReveal(target.id);
  };

  const copyReport = () => {
    if (!report) return;
    const markdown = issueMarkdown(issue, { finding, cut, selector, fixes: fixes ?? null }, report);
    void navigator.clipboard.writeText(markdown).then(markCopied);
  };

  const shotName = () => `${screenshotName(report?.url ?? '', finding.element.label)}.png`;
  /** Says why a screenshot couldn't be taken, and what to do about it. */
  const shotFailed = (error: unknown) => {
    toast(
      error instanceof CaptureNotAllowed
        ? i18n.t('detail.screenshotNeedsClick')
        : error instanceof CaptureHidden
          ? i18n.t('detail.screenshotHidden')
          : i18n.t('detail.screenshotFailed', [
              error instanceof Error ? error.message : String(error),
            ]),
    );
  };

  const copyScreenshot = () => {
    setShooting(true);
    const image = onScreenshot(finding.id);
    // The clipboard gets the promise at once, so the click still counts as the gesture.
    navigator.clipboard
      .write([new ClipboardItem({ 'image/png': image })])
      .then(markShotCopied, async () => {
        // No clipboard (or the capture failed): save the file instead, or say why not.
        downloadBlob(shotName(), await image);
        toast(i18n.t('detail.screenshotSaved'));
      })
      .catch(shotFailed)
      .finally(() => {
        setShooting(false);
      });
  };

  const downloadScreenshot = () => {
    setShooting(true);
    onScreenshot(finding.id)
      .then((image) => {
        downloadBlob(shotName(), image);
        markShotSaved();
      })
      .catch(shotFailed)
      .finally(() => {
        setShooting(false);
      });
  };

  return (
    <article
      className="flex min-w-0 animate-enter flex-col gap-6"
      aria-label={kindLabel(issue.kind)}
    >
      <StepHeader backLabel={i18n.t('actions.allProblems')} onBack={onBack}>
        {places > 1 && (
          <span className="-me-2 flex items-center">
            <IconButton
              label={i18n.t('actions.previous')}
              icon={<ChevronLeft {...ICON} className="rtl:rotate-180" />}
              disabled={index === 0}
              onClick={() => {
                go(index - 1);
              }}
            />
            <span className="px-1 text-small text-fg-muted tabular-nums" aria-live="polite">
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
      </StepHeader>

      {/* What's wrong, then the text as readers see it: the one large thing in the panel. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="flex flex-wrap items-center gap-x-2 text-title font-semibold">
            <span aria-hidden="true" className={cx('size-2.5 rounded-full', TONE_BG[tone])} />
            {kindLabel(issue.kind)}
            {fresh && (
              <span className="rounded-[4px] bg-accent-soft px-1.5 text-small font-medium">
                {i18n.t('results.new')}
              </span>
            )}
          </h2>
          <p className="text-pretty text-fg-muted">{kindDescription(issue.kind)}</p>
        </div>
        <figure className="flex flex-col gap-3 rounded-card bg-raised p-4 shadow-raised">
          {cut ? (
            <p className="text-specimen">
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
            finding.text !== '' && <p className="text-specimen break-words">{finding.text}</p>
          )}
          <figcaption className="text-small text-fg-muted tabular-nums">
            {measurementSentence(measurement(finding, viewport))}
          </figcaption>
        </figure>
      </div>

      <Fixes finding={finding} result={fixes} onPreview={onPreview} />

      <section className="flex flex-col gap-3" aria-label={i18n.t('try.heading')}>
        <div className="flex flex-col gap-1">
          <h2 className="text-title font-semibold">{i18n.t('try.heading')}</h2>
          <p className="text-pretty text-fg-muted">{i18n.t('try.hint')}</p>
        </div>
        {tryText?.id === finding.id && (
          <TextTrial key={finding.id} initialText={tryText.text} onTry={tryOnFinding} />
        )}
      </section>

      {/* Quiet actions, named in words; the page shows the element outlined already. */}
      <div className="-mx-2 flex flex-wrap items-center gap-y-1">
        <Button
          size="sm"
          variant="ghost"
          icon={<LocateFixed {...SMALL} />}
          onClick={() => {
            onReveal(finding.id);
          }}
        >
          {i18n.t('actions.jump')}
        </Button>
        {report && (
          <Button
            size="sm"
            variant="ghost"
            icon={copied ? <Check {...SMALL} className="text-ok" /> : <ClipboardCopy {...SMALL} />}
            onClick={copyReport}
          >
            {copied ? i18n.t('actions.copied') : i18n.t('actions.copyReport')}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={shooting}
          icon={shotCopied ? <Check {...SMALL} className="text-ok" /> : <Camera {...SMALL} />}
          onClick={copyScreenshot}
        >
          {shotCopied ? i18n.t('actions.copied') : i18n.t('actions.copyScreenshot')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={shooting}
          icon={shotSaved ? <Check {...SMALL} className="text-ok" /> : <Download {...SMALL} />}
          onClick={downloadScreenshot}
        >
          {shotSaved ? i18n.t('actions.downloaded') : i18n.t('actions.downloadScreenshot')}
        </Button>
        {ignored ? (
          <Button size="sm" variant="ghost" icon={<Eye {...SMALL} />} onClick={onUnignore}>
            {i18n.t('actions.unignore')}
          </Button>
        ) : (
          onIgnore && (
            <Button size="sm" variant="ghost" icon={<EyeOff {...SMALL} />} onClick={onIgnore}>
              {i18n.t('actions.ignore')}
            </Button>
          )
        )}
      </div>

      <details className="group flex flex-col border-t border-line pt-2">
        <summary className="-mx-2 flex min-h-8 cursor-default items-center gap-1.5 rounded-control px-2 font-medium transition-[background-color] duration-(--duration-press) ease-(--ease-out) select-none hover:bg-surface [&::-webkit-details-marker]:hidden">
          <ChevronRight
            {...SMALL}
            aria-hidden="true"
            className="text-fg-muted transition-transform duration-(--duration-press) ease-(--ease-out) group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90"
          />
          {i18n.t('detail.why')}
        </summary>
        <div className="mt-2 flex flex-col gap-4">
          {finding.diagnosis.causes.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line">
              {finding.diagnosis.causes.map((cause) => (
                <li
                  key={`${cause.property}|${cause.value}|${cause.element.label}`}
                  className="flex flex-col gap-1 py-2.5"
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

          {finding.before && (
            <section className="flex flex-col gap-1">
              <h3 className="text-small text-fg-muted">{i18n.t('detail.before')}</h3>
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
              {selector ?? '...'}
            </dd>
            <dd>
              {selector && <CopyButton text={selector} label={i18n.t('actions.copySelector')} />}
            </dd>
          </dl>
        </div>
      </details>
    </article>
  );
}
