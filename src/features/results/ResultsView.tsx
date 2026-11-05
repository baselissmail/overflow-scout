import { i18n } from '#i18n';
import { Info, Search } from 'lucide-react';
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';

import type { PanelController, PanelState } from '@/features/page/controller';
import type { IssueDto, ScanResultDto } from '@/messaging/protocol';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Popover } from '@/ui/Popover';
import { Segmented } from '@/ui/Segmented';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/Tabs';

import { IssueDetail } from './IssueDetail';
import { ResultList } from './ResultList';
import type { ResultFilter, SortOrder } from './filter';
import { NO_FILTER, applyFilter, countByKind } from './filter';
import type { Kind } from './labels';
import { KINDS, NBSP, SEVERITY_TONE, formatCount, kindLabel } from './labels';

type Stats = ScanResultDto['stats'];
type Tab = 'atRisk' | 'brokenNow';

export interface ResultsViewProps {
  state: PanelState;
  controller: PanelController;
  /** List and detail side by side (panel at least 520 px wide). */
  wide: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onRunStress: () => void;
}

const TONE_OF_KIND: Readonly<Record<Kind, IssueDto['severity']>> = {
  hidden: 'critical',
  'page-scroll': 'critical',
  truncated: 'warning',
  spilling: 'warning',
  input: 'notice',
};

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

function Footer({ stats, viewport, stress }: { stats: Stats; viewport: string; stress: boolean }) {
  const ms = formatCount(Math.round(stats.durationMs));
  const text = stress
    ? i18n.t('results.footerStress', [formatCount(stats.textNodes), ms])
    : i18n.t('results.footer', [formatCount(stats.textNodes), ms, viewport]);
  return (
    <footer className="flex items-center justify-between gap-2 border-t border-line pt-1">
      <p className="min-w-0 text-small text-fg-muted tabular-nums">{text}</p>
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
    </footer>
  );
}

interface BodyProps {
  issues: readonly IssueDto[];
  filter: ResultFilter;
  setFilter: Dispatch<SetStateAction<ResultFilter>>;
  viewport: { width: number; height: number };
  wide: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  controller: PanelController;
  empty: ReactNode;
}

function ResultsBody({
  issues,
  filter,
  setFilter,
  viewport,
  wide,
  searchRef,
  controller,
  empty,
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
  const loadSelector = useCallback((id: string) => controller.selector(id), [controller]);
  const close = useCallback(() => {
    setOpenId(null);
    controller.highlight(null);
  }, [controller]);

  if (issues.length === 0) return <>{empty}</>;

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
      issues={shown}
      selectedId={selectedId}
      label={i18n.t('results.heading')}
      onSelect={(issue) => {
        setSelectedId(issue.id);
      }}
      onOpen={(issue) => {
        setOpenId(issue.id);
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
        loadSelector={loadSelector}
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
      <div role="group" aria-label={i18n.t('results.filters')} className="flex flex-wrap gap-1.5">
        {KINDS.filter((kind) => counts.has(kind)).map((kind) => (
          <Chip
            key={kind}
            tone={SEVERITY_TONE[TONE_OF_KIND[kind]]}
            label={kindLabel(kind)}
            count={counts.get(kind) ?? 0}
            pressed={filter.kinds.has(kind)}
            onClick={() => {
              toggleKind(kind);
            }}
          />
        ))}
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
            className="min-h-8 w-full rounded-control border border-line-strong bg-canvas ps-7 pe-2"
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
        (detail ?? <div className="flex min-h-0 flex-1 flex-col">{list}</div>)
      )}
    </div>
  );
}

export function ResultsView({ state, controller, wide, searchRef, onRunStress }: ResultsViewProps) {
  const [filter, setFilter] = useState<ResultFilter>(NO_FILTER);
  const [tab, setTab] = useState<Tab>('atRisk');
  const body = (issues: readonly IssueDto[], viewport: BodyProps['viewport'], empty: ReactNode) => (
    <ResultsBody
      issues={issues}
      filter={filter}
      setFilter={setFilter}
      viewport={viewport}
      wide={wide}
      searchRef={searchRef}
      controller={controller}
      empty={empty}
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
          <TabsList label={i18n.t('results.heading')}>
            <TabsTrigger value="atRisk">
              {i18n.t('results.atRisk')}
              <span className="tabular-nums">{formatCount(stress.atRisk.length)}</span>
            </TabsTrigger>
            <TabsTrigger value="brokenNow">
              {i18n.t('results.brokenNow')}
              <span className="tabular-nums">{formatCount(stress.brokenNow.length)}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="atRisk" className="flex min-h-0 flex-1 flex-col">
            {body(
              stress.atRisk,
              stress.viewport,
              <EmptyState title={i18n.t('results.noneAtRisk')} />,
            )}
          </TabsContent>
          <TabsContent value="brokenNow" className="flex min-h-0 flex-1 flex-col">
            {body(
              stress.brokenNow,
              stress.viewport,
              <EmptyState title={i18n.t('results.noneNow')} />,
            )}
          </TabsContent>
        </Tabs>
        <Footer
          stats={stress.stats.stressed}
          viewport={`${String(stress.viewport.width)}×${String(stress.viewport.height)}`}
          stress
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
        <Footer stats={scan.stats} viewport={viewport} stress={false} />
      </section>
    );
  }

  return null;
}
