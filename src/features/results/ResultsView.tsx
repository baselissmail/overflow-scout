import { i18n } from '#i18n';
import { Check, ClipboardCopy, Search } from 'lucide-react';
import type { RefObject } from 'react';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';

import type { PanelController, PanelState } from '@/features/page/controller';
import { exportResults, reportContext } from '@/features/report/export';
import type { IssueDto, PreviewKey, TextValueDto } from '@/messaging/protocol';
import { siteOf } from '@/storage/ignore';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

import { useCopied } from './CopyButton';
import { IssueDetail } from './IssueDetail';
import { ResultList } from './ResultList';
import { NO_FILTER, applyFilter } from './filter';
import { formatCount } from './labels';
import type { IgnoreRules } from './use-ignore';
import { ignoredOn } from './use-ignore';

/** Above this many problems, a search field helps; below it, it's one more thing to read. */
const SEARCH_FROM = 12;

/** The problems on screen: from the latest check, at the length the page's text was. */
export interface Shown {
  /** New-with-longer-text problems first, then the ones that were there already. */
  issues: readonly IssueDto[];
  /** Problems that appear only with longer text. */
  fresh: ReadonlySet<string>;
  textNodes: number;
  viewport: { width: number; height: number };
  /** Taken with longer text on the page. */
  longer: boolean;
}

const NONE: ReadonlySet<string> = new Set();

export function shownResults(state: PanelState): Shown | null {
  if (state.showing === 'stress' && state.stress) {
    const { atRisk, brokenNow, stats, viewport } = state.stress;
    return {
      issues: [...atRisk, ...brokenNow],
      fresh: new Set(atRisk.map((issue) => issue.id)),
      textNodes: stats.stressed.textNodes,
      viewport,
      longer: true,
    };
  }
  if (state.showing === 'scan' && state.scan) {
    const { issues, stats, viewport } = state.scan;
    return { issues, fresh: NONE, textNodes: stats.textNodes, viewport, longer: false };
  }
  return null;
}

/** Problems ignored on this site, and what can be done with them. */
export interface Ignoring {
  ids: ReadonlySet<string>;
  shown: boolean;
  toggle: () => void;
  /** Null on pages without a site (about: pages, for one). */
  ignore: ((issue: IssueDto) => void) | null;
  unignore: (issue: IssueDto) => void;
}

export function useIgnoring(ignore: IgnoreRules, state: PanelState): Ignoring {
  const [shown, setShown] = useState(false);
  const site = state.page ? siteOf(state.page.url) : null;
  return {
    ids: ignoredOn(ignore.rules, site),
    shown,
    toggle: () => {
      setShown((value) => !value);
    },
    ignore:
      site === null
        ? null
        : (issue) => {
            ignore.ignore(site, issue, issue.instances[0]?.element.label ?? '');
          },
    unignore: (issue) => {
      if (site !== null) ignore.unignore(site, issue.id);
    },
  };
}

interface ProblemListProps {
  state: PanelState;
  shown: Shown;
  ignoring: Ignoring;
  query: string;
  onQuery: (query: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (issue: IssueDto) => void;
  controller: PanelController;
}

/** How many problems, what's new with longer text, and the list itself. */
export function ProblemList({
  state,
  shown,
  ignoring,
  query,
  onQuery,
  searchRef,
  selectedId,
  onSelect,
  onOpen,
  controller,
}: ProblemListProps) {
  const [copied, markCopied] = useCopied();
  const ignoredHere = shown.issues.filter((issue) => ignoring.ids.has(issue.id)).length;
  const visible = useMemo(
    () =>
      ignoring.shown ? shown.issues : shown.issues.filter((issue) => !ignoring.ids.has(issue.id)),
    [ignoring.shown, ignoring.ids, shown.issues],
  );
  const searchable = visible.length > SEARCH_FROM;
  const deferred = useDeferredValue(query);
  // Search keeps the order: new ones first, then the rest, most serious first.
  const listed = useMemo(
    () =>
      searchable && deferred !== ''
        ? applyFilter(visible, { ...NO_FILTER, query: deferred })
        : visible,
    [searchable, deferred, visible],
  );
  const count = visible.length;
  const fresh = visible.filter((issue) => shown.fresh.has(issue.id)).length;

  const copyReport = () => {
    const exported = exportResults(state, ignoring.ids);
    if (exported) void navigator.clipboard.writeText(exported.markdown).then(markCopied);
  };

  if (count === 0 && ignoredHere === 0) {
    return shown.longer ? (
      <EmptyState
        title={i18n.t('results.noneLongerTitle')}
        body={i18n.t('results.noneLongerBody', [formatCount(shown.textNodes)])}
      />
    ) : (
      <EmptyState
        title={i18n.t('results.noneTitle')}
        body={i18n.t('results.noneBody', [formatCount(shown.textNodes)])}
      />
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3" aria-label={i18n.t('results.label')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col" aria-live="polite">
          <h2 className="text-title font-semibold tabular-nums">
            {i18n.t('results.count', count, [formatCount(count)])}
          </h2>
          <p className="text-small text-fg-muted tabular-nums">
            {shown.longer
              ? i18n.t('results.newCount', fresh, [formatCount(fresh)])
              : i18n.t('results.checked', shown.textNodes, [formatCount(shown.textNodes)])}
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          icon={
            copied ? (
              <Check size={14} strokeWidth={1.5} className="text-ok" />
            ) : (
              <ClipboardCopy size={14} strokeWidth={1.5} />
            )
          }
          onClick={copyReport}
        >
          {copied ? i18n.t('actions.copied') : i18n.t('actions.copyReport')}
        </Button>
      </div>

      {searchable && (
        <label className="relative">
          <span className="sr-only">{i18n.t('results.search')}</span>
          <Search
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted"
          />
          <input
            ref={searchRef}
            type="search"
            name="search"
            autoComplete="off"
            spellCheck={false}
            placeholder={i18n.t('results.searchPlaceholder')}
            value={query}
            onChange={(event) => {
              onQuery(event.target.value);
            }}
            className="min-h-8 w-full rounded-control border border-line-strong bg-raised ps-8 pe-2 transition-[border-color] duration-(--duration-press) ease-(--ease-out) placeholder:text-fg-muted focus:border-accent"
          />
        </label>
      )}

      {listed.length === 0 ? (
        count > 0 && <EmptyState title={i18n.t('results.noMatches')} />
      ) : (
        <ResultList
          issues={listed}
          viewportWidth={shown.viewport.width}
          selectedId={selectedId}
          label={i18n.t('results.label')}
          ignored={ignoring.ids}
          fresh={shown.fresh}
          onSelect={(issue) => {
            onSelect(issue.id);
          }}
          onOpen={onOpen}
          onHighlight={(findingId) => {
            controller.highlight(findingId);
          }}
        />
      )}

      {ignoredHere > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="-ms-2 self-start text-fg-muted hover:text-fg"
          aria-pressed={ignoring.shown}
          onClick={ignoring.toggle}
        >
          {ignoring.shown
            ? i18n.t('results.hideIgnored')
            : i18n.t('results.showIgnored', ignoredHere, [formatCount(ignoredHere)])}
        </Button>
      )}
    </section>
  );
}

interface ProblemViewProps {
  state: PanelState;
  controller: PanelController;
  issue: IssueDto;
  shown: Shown;
  ignoring: Ignoring;
  onBack: () => void;
}

/** One problem's details, wired to the page. */
export function ProblemView({
  state,
  controller,
  issue,
  shown,
  ignoring,
  onBack,
}: ProblemViewProps) {
  const highlight = useCallback(
    (findingId: string | null) => {
      controller.highlight(findingId);
    },
    [controller],
  );
  const loadDetails = useCallback((id: string) => controller.details(id), [controller]);
  const loadFixes = useCallback((id: string) => controller.fixes(id), [controller]);
  const screenshot = useCallback((id: string) => controller.screenshot(id), [controller]);
  const tryText = useCallback(
    (value: TextValueDto | null, id: string) => controller.tryText(value, id),
    [controller],
  );
  const textOf = useCallback((id: string) => controller.textOf(id), [controller]);
  const preview = useCallback(
    (id: string, key: PreviewKey | null) => controller.preview(id, key),
    [controller],
  );
  return (
    <IssueDetail
      key={issue.id}
      issue={issue}
      viewport={shown.viewport}
      fresh={shown.fresh.has(issue.id)}
      onBack={onBack}
      onReveal={(id) => void controller.reveal(id)}
      onHighlight={highlight}
      loadDetails={loadDetails}
      loadFixes={loadFixes}
      onPreview={preview}
      report={reportContext(state)}
      onScreenshot={screenshot}
      onTryText={tryText}
      onTextOf={textOf}
      ignored={ignoring.ids.has(issue.id)}
      onIgnore={
        ignoring.ignore &&
        (() => {
          ignoring.ignore?.(issue);
        })
      }
      onUnignore={() => {
        ignoring.unignore(issue);
      }}
    />
  );
}
