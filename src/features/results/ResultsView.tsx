import { i18n } from '#i18n';
import { CircleHelp, Info, Search } from 'lucide-react';
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';

import type { PanelController, PanelState } from '@/features/page/controller';
import { ExportMenu } from '@/features/report/ExportMenu';
import { reportContext } from '@/features/report/export';
import type { ReportContext } from '@/features/report/markdown';
import { siteOf } from '@/storage/ignore';
import { intensityLabel, languageLabel, strategyLabel } from '@/features/stress/options';
import type { IssueDto, PreviewKey, ScanResultDto } from '@/messaging/protocol';
import { Button } from '@/ui/Button';
import { Chip, TONE_BG, TONE_TEXT } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Popover } from '@/ui/Popover';
import { Segmented } from '@/ui/Segmented';
import { SeverityBar } from '@/ui/SeverityBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/Tabs';
import { Tooltip } from '@/ui/Tooltip';
import { useCountUp } from '@/ui/use-count-up';

import { IssueDetail } from './IssueDetail';
import type { IgnoreRules } from './use-ignore';
import { ignoredOn } from './use-ignore';
import { ResultList } from './ResultList';
import type { ResultFilter, SortOrder } from './filter';
import { NO_FILTER, applyFilter, countByKind } from './filter';
import type { Kind } from './labels';
import {
  KINDS,
  KindIcon,
  NBSP,
  SEVERITY_TONE,
  formatCount,
  kindDescription,
  kindLabel,
  severityLabel,
} from './labels';

type Stats = ScanResultDto['stats'];
type Tab = 'atRisk' | 'brokenNow';

export interface ResultsViewProps {
  state: PanelState;
  controller: PanelController;
  /** List and detail side by side (panel at least 520 px wide). */
  wide: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onRunStress: () => void;
  ignore: IgnoreRules;
}

/** Issues ignored on this site in one set of results, and what can be done with them. */
interface Ignoring {
  ids: ReadonlySet<string>;
  /** Ignored issues among these results (hidden unless shown). */
  count: number;
  shown: boolean;
  toggle: () => void;
  /** Null on pages without a site (e.g. the extension's own demo page has one; about: pages don't). */
  ignore: ((issue: IssueDto) => void) | null;
  unignore: (issue: IssueDto) => void;
}

const TONE_OF_KIND: Readonly<Record<Kind, IssueDto['severity']>> = {
  hidden: 'critical',
  'page-scroll': 'critical',
  truncated: 'warning',
  spilling: 'warning',
  input: 'notice',
};

/** A filter chip whose count lands with a short count-up. */
function KindChip({
  kind,
  count,
  pressed,
  onToggle,
}: {
  kind: Kind;
  count: number;
  pressed: boolean;
  onToggle: (kind: Kind) => void;
}) {
  const shown = useCountUp(count);
  return (
    <Tooltip content={kindDescription(kind)}>
      <Chip
        tone={SEVERITY_TONE[TONE_OF_KIND[kind]]}
        icon={<KindIcon kind={kind} />}
        label={kindLabel(kind)}
        count={shown}
        pressed={pressed}
        onClick={() => {
          onToggle(kind);
        }}
      />
    </Tooltip>
  );
}

const SEVERITIES = ['critical', 'warning', 'notice'] as const;

/** "3 critical · 2 warnings", leaving out severities with nothing in them. */
function severityLine(issues: readonly IssueDto[]): string {
  const count = (severity: IssueDto['severity']) =>
    issues.filter((issue) => issue.severity === severity).length;
  const parts: string[] = [];
  const critical = count('critical');
  const warning = count('warning');
  const notice = count('notice');
  if (critical > 0)
    parts.push(i18n.t('results.severityCount.critical', critical, [formatCount(critical)]));
  if (warning > 0)
    parts.push(i18n.t('results.severityCount.warning', warning, [formatCount(warning)]));
  if (notice > 0) parts.push(i18n.t('results.severityCount.notice', notice, [formatCount(notice)]));
  return parts.join(' · ');
}

function severitySummary(issues: readonly IssueDto[]): string {
  const count = (severity: IssueDto['severity']) =>
    issues.filter((issue) => issue.severity === severity).length;
  return i18n.t('results.severitySummary', [
    String(count('critical')),
    String(count('warning')),
    String(count('notice')),
  ]);
}

function Coverage({ stats, viewport }: { stats: Stats; viewport: string | null }) {
  const rows: [string, string][] = [
    [i18n.t('results.coverageTextNodes'), formatCount(stats.textNodes)],
    [i18n.t('results.coverageInputs'), formatCount(stats.inputs)],
    [i18n.t('results.coverageInvisible'), formatCount(stats.skippedInvisible)],
    [i18n.t('results.coverageForeign'), formatCount(stats.skippedForeign)],
    [i18n.t('results.coverageShadowRoots'), formatCount(stats.shadowRoots)],
    [i18n.t('results.coverageFrames'), formatCount(stats.framesSkipped)],
    [i18n.t('results.coverageTime'), `${formatCount(Math.round(stats.durationMs))}${NBSP}ms`],
    ...(viewport ? ([[i18n.t('results.coverageViewport'), viewport]] as [string, string][]) : []),
  ];
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-fg-muted">{term}</dt>
          <dd className="text-end tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Each level, defined by the kinds it covers, so a report can be triaged the same way. */
function SeverityHelp() {
  return (
    <>
      <p className="mb-2 font-medium">{i18n.t('results.severityHelp.title')}</p>
      <dl className="flex flex-col gap-2">
        {SEVERITIES.map((severity) => (
          <div key={severity} className="flex flex-col">
            <dt className={`text-small font-medium ${TONE_TEXT[SEVERITY_TONE[severity]]}`}>
              {severityLabel(severity)}
            </dt>
            <dd className="text-small text-fg-muted">
              {severity === 'critical'
                ? i18n.t('results.severityHelp.critical')
                : severity === 'warning'
                  ? i18n.t('results.severityHelp.warning')
                  : i18n.t('results.severityHelp.notice')}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function Footer({
  stats,
  viewport,
  stress,
  state,
  ignored,
}: {
  stats: Stats;
  viewport: string;
  stress: boolean;
  state: PanelState;
  ignored: ReadonlySet<string>;
}) {
  const ms = formatCount(Math.round(stats.durationMs));
  const text = stress
    ? i18n.t('results.footerStress', [formatCount(stats.textNodes), ms])
    : i18n.t('results.footer', [formatCount(stats.textNodes), ms, viewport]);
  return (
    <footer className="flex items-center justify-between gap-2 border-t border-line pt-1">
      <p className="min-w-0 text-small text-fg-muted tabular-nums">{text}</p>
      <span className="flex shrink-0 items-center">
        <ExportMenu state={state} ignored={ignored} />
        <Popover
          label={i18n.t('results.coverage')}
          trigger={
            <IconButton
              label={i18n.t('results.coverage')}
              icon={<Info size={16} strokeWidth={1.5} />}
            />
          }
        >
          <p className="mb-2 font-medium">{i18n.t('results.coverage')}</p>
          <Coverage stats={stats} viewport={stress ? null : viewport} />
        </Popover>
      </span>
    </footer>
  );
}

interface BodyProps {
  issues: readonly IssueDto[];
  /** Changes with each new set of results, so the list replays its arrival once. */
  resultsKey: string;
  filter: ResultFilter;
  setFilter: Dispatch<SetStateAction<ResultFilter>>;
  viewport: { width: number; height: number };
  wide: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  controller: PanelController;
  empty: ReactNode;
  /** Where the results come from, for the reports copied from a result's details. */
  report: ReportContext | null;
  ignoring: Ignoring;
}

function ResultsBody({
  issues,
  resultsKey,
  filter,
  setFilter,
  viewport,
  wide,
  searchRef,
  controller,
  empty,
  report,
  ignoring,
}: BodyProps) {
  const query = useDeferredValue(filter.query);
  const shown = useMemo(() => applyFilter(issues, { ...filter, query }), [issues, filter, query]);
  const counts = useMemo(() => countByKind(issues), [issues]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = shown.find((issue) => issue.id === openId) ?? null;

  const highlight = useCallback(
    (findingId: string | null) => {
      controller.highlight(findingId);
    },
    [controller],
  );
  const loadDetails = useCallback((id: string) => controller.details(id), [controller]);
  const loadFixes = useCallback((id: string) => controller.fixes(id), [controller]);
  const screenshot = useCallback((id: string) => controller.screenshot(id), [controller]);
  const preview = useCallback(
    (id: string, key: PreviewKey | null) => controller.preview(id, key),
    [controller],
  );
  /** Narrow panels swap list and detail; a view transition keeps the change legible. */
  const swap = useCallback(
    (update: () => void) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (wide || reduced || !('startViewTransition' in document)) {
        update();
        return;
      }
      document.startViewTransition(() => {
        // The DOM must change inside the transition callback, so React renders synchronously.
        // eslint-disable-next-line @eslint-react/dom-no-flush-sync
        flushSync(update);
      });
    },
    [wide],
  );
  const close = useCallback(() => {
    swap(() => {
      setOpenId(null);
    });
    controller.highlight(null);
  }, [controller, swap]);

  if (issues.length === 0) return <>{empty}</>;
  const filtering = filter.kinds.size > 0 || filter.query !== '';

  const toggleKind = (kind: Kind) => {
    setFilter((current) => {
      const kinds = new Set(current.kinds);
      if (kinds.has(kind)) kinds.delete(kind);
      else kinds.add(kind);
      return { ...current, kinds };
    });
  };

  const list = (
    <ResultList
      key={resultsKey}
      issues={shown}
      viewportWidth={viewport.width}
      selectedId={selectedId}
      label={i18n.t('results.heading')}
      ignored={ignoring.ids}
      onSelect={(issue) => {
        setSelectedId(issue.id);
      }}
      onOpen={(issue) => {
        swap(() => {
          setOpenId(issue.id);
        });
        const first = issue.instances[0];
        if (first) void controller.reveal(first.id);
      }}
      onHighlight={(findingId) => {
        // While details are open, the outline stays on the opened element.
        if (!open) highlight(findingId);
      }}
    />
  );
  const detail = open ? (
    <div className="min-h-0 overflow-y-auto overscroll-contain">
      <IssueDetail
        key={open.id}
        issue={open}
        viewport={viewport}
        onBack={wide ? null : close}
        onReveal={(id) => void controller.reveal(id)}
        onHighlight={highlight}
        loadDetails={loadDetails}
        loadFixes={loadFixes}
        onPreview={preview}
        report={report}
        onScreenshot={screenshot}
        ignored={ignoring.ids.has(open.id)}
        onIgnore={
          ignoring.ignore &&
          (() => {
            ignoring.ignore?.(open);
          })
        }
        onUnignore={() => {
          ignoring.unignore(open);
        }}
      />
    </div>
  ) : null;

  return (
    // Esc closes the details from anywhere inside the results (list or detail).
    // A React handler is active as soon as it renders, unlike an effect. It only
    // handles keys bubbling from the focusable list and buttons inside.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="flex min-h-0 flex-1 flex-col gap-2"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open && !event.defaultPrevented) {
          event.preventDefault();
          close();
        }
      }}
    >
      {/* List controls step aside while a narrow detail is open; they don't affect it. */}
      {(wide || !open) && (
        <>
          <div className="flex flex-col gap-1">
            <SeverityBar
              label={severitySummary(issues)}
              segments={SEVERITIES.map((severity) => ({
                key: severity,
                count: issues.filter((issue) => issue.severity === severity).length,
                colorClass: TONE_BG[SEVERITY_TONE[severity]],
              }))}
            />
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <span className="flex min-w-0 items-center">
                <p className="text-small text-fg-muted tabular-nums" aria-hidden="true">
                  {severityLine(issues)}
                </p>
                <Popover
                  label={i18n.t('results.severityHelp.title')}
                  trigger={
                    <IconButton
                      label={i18n.t('results.severityHelp.title')}
                      icon={<CircleHelp size={14} strokeWidth={1.5} />}
                    />
                  }
                >
                  <SeverityHelp />
                </Popover>
              </span>
              <span className="flex flex-wrap items-center">
                {ignoring.count > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-pressed={ignoring.shown}
                    onClick={ignoring.toggle}
                  >
                    {ignoring.shown
                      ? i18n.t('results.hideIgnored')
                      : i18n.t('results.showIgnored', ignoring.count, [
                          formatCount(ignoring.count),
                        ])}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    controller.clearResults();
                  }}
                >
                  {i18n.t('actions.clearResults')}
                </Button>
              </span>
            </div>
          </div>
          <div
            role="group"
            aria-label={i18n.t('results.filters')}
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="text-small text-fg-muted">{i18n.t('results.filterLabel')}</span>
            {KINDS.filter((kind) => counts.has(kind)).map((kind) => (
              <KindChip
                key={kind}
                kind={kind}
                count={counts.get(kind) ?? 0}
                pressed={filter.kinds.has(kind)}
                onToggle={toggleKind}
              />
            ))}
            {filtering && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFilter((current) => ({ ...current, kinds: new Set(), query: '' }));
                }}
              >
                {i18n.t('results.clearFilters')}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-48 flex-1">
              <span className="sr-only">{i18n.t('results.search')}</span>
              <Search
                size={14}
                strokeWidth={1.5}
                aria-hidden="true"
                className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-fg-muted"
              />
              <input
                ref={searchRef}
                type="search"
                name="search"
                autoComplete="off"
                spellCheck={false}
                placeholder={i18n.t('results.searchPlaceholder')}
                value={filter.query}
                onChange={(event) => {
                  const value = event.target.value;
                  setFilter((current) => ({ ...current, query: value }));
                }}
                className="min-h-8 w-full rounded-control border border-line-strong bg-raised ps-7 pe-2"
              />
            </label>
            <Segmented<SortOrder>
              label={i18n.t('results.sort')}
              value={filter.sort}
              onChange={(sort) => {
                setFilter((current) => ({ ...current, sort }));
              }}
              options={[
                { value: 'severity', label: i18n.t('results.sortSeverity') },
                { value: 'page', label: i18n.t('results.sortPage') },
              ]}
            />
          </div>
        </>
      )}
      {shown.length === 0 ? (
        <EmptyState title={i18n.t('results.noMatches')} />
      ) : wide ? (
        // Both columns are always there, so the list keeps its width (and its
        // rows their measured heights) when details open.
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          <div className="flex min-h-0 flex-col">{list}</div>
          {detail ?? <p className="p-2 text-fg-muted">{i18n.t('results.selectHint')}</p>}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col [view-transition-name:results-pane]">
          {detail ?? list}
        </div>
      )}
    </div>
  );
}

/** A stable key per result object: a new scan or stress test gets a new one. */
const resultKeys = new WeakMap<object, number>();
let nextResultKey = 0;
function keyOf(result: object): string {
  let key = resultKeys.get(result);
  if (key === undefined) {
    nextResultKey += 1;
    key = nextResultKey;
    resultKeys.set(result, key);
  }
  return String(key);
}

export function ResultsView({
  state,
  controller,
  wide,
  searchRef,
  onRunStress,
  ignore,
}: ResultsViewProps) {
  const [showIgnored, setShowIgnored] = useState(false);
  const site = state.page ? siteOf(state.page.url) : null;
  const ignoredIds = ignoredOn(ignore.rules, site);
  const ignoring = (issues: readonly IssueDto[]): Ignoring => ({
    ids: ignoredIds,
    count: issues.filter((issue) => ignoredIds.has(issue.id)).length,
    shown: showIgnored,
    toggle: () => {
      setShowIgnored((shown) => !shown);
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
  });
  const visible = (issues: readonly IssueDto[]) =>
    showIgnored ? issues : issues.filter((issue) => !ignoredIds.has(issue.id));
  const [filter, setFilter] = useState<ResultFilter>(NO_FILTER);
  const [tab, setTab] = useState<Tab>('atRisk');
  const atRisk = useCountUp(state.stress?.atRisk.length ?? 0);
  const brokenNow = useCountUp(state.stress?.brokenNow.length ?? 0);
  const report = reportContext(state);
  const body = (
    issues: readonly IssueDto[],
    resultsKey: string,
    viewport: BodyProps['viewport'],
    empty: ReactNode,
  ) => (
    <ResultsBody
      issues={visible(issues)}
      ignoring={ignoring(issues)}
      resultsKey={resultsKey}
      filter={filter}
      setFilter={setFilter}
      viewport={viewport}
      wide={wide}
      searchRef={searchRef}
      controller={controller}
      empty={empty}
      report={report}
    />
  );

  if (state.showing === 'stress' && state.stress) {
    const { stress } = state;
    return (
      <section
        className="flex min-h-0 flex-1 flex-col gap-2"
        aria-label={i18n.t('results.heading')}
      >
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as Tab);
          }}
          className="flex min-h-0 flex-1 flex-col gap-2"
        >
          {!state.stressActive && (
            <p className="rounded-card bg-raised px-3 py-2 shadow-raised" role="status">
              {i18n.t('results.restored')}
            </p>
          )}
          <p className="text-small text-fg-muted tabular-nums">
            {i18n.t('results.stressSummary', [
              state.stressOptions
                ? state.stressOptions.strategy === 'language'
                  ? languageLabel(state.stressOptions.language)
                  : strategyLabel(state.stressOptions.strategy)
                : '',
              state.stressOptions ? intensityLabel(state.stressOptions.intensity) : '',
              String(stress.stats.stress.growth),
              formatCount(stress.atRisk.length),
              formatCount(stress.brokenNow.length),
            ])}
          </p>
          <TabsList label={i18n.t('results.heading')}>
            <TabsTrigger value="atRisk">
              {i18n.t('results.atRisk')}
              <span className="tabular-nums">{formatCount(atRisk)}</span>
            </TabsTrigger>
            <TabsTrigger value="brokenNow">
              {i18n.t('results.brokenNow')}
              <span className="tabular-nums">{formatCount(brokenNow)}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="atRisk" className="flex min-h-0 flex-1 flex-col">
            {body(
              stress.atRisk,
              `${keyOf(stress)}-at-risk`,
              stress.viewport,
              <EmptyState title={i18n.t('results.noneAtRisk')} />,
            )}
          </TabsContent>
          <TabsContent value="brokenNow" className="flex min-h-0 flex-1 flex-col">
            {body(
              stress.brokenNow,
              `${keyOf(stress)}-broken-now`,
              stress.viewport,
              <EmptyState title={i18n.t('results.noneNow')} />,
            )}
          </TabsContent>
        </Tabs>
        <Footer
          stats={stress.stats.stressed}
          viewport={`${String(stress.viewport.width)}×${String(stress.viewport.height)}`}
          stress
          state={state}
          ignored={ignoredIds}
        />
      </section>
    );
  }

  if (state.showing === 'scan' && state.scan) {
    const { scan } = state;
    const viewport = `${String(scan.viewport.width)}×${String(scan.viewport.height)}`;
    return (
      <section
        className="flex min-h-0 flex-1 flex-col gap-2"
        aria-label={i18n.t('results.heading')}
      >
        {body(
          scan.issues,
          keyOf(scan),
          scan.viewport,
          <EmptyState
            title={i18n.t('results.none', [formatCount(scan.stats.textNodes), viewport])}
            action={
              <Button size="sm" onClick={onRunStress}>
                {i18n.t('actions.runStress')}
              </Button>
            }
          />,
        )}
        <Footer
          stats={scan.stats}
          viewport={viewport}
          stress={false}
          state={state}
          ignored={ignoredIds}
        />
      </section>
    );
  }

  return null;
}
