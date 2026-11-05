import { i18n } from '#i18n';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { IssueDto } from '@/messaging/protocol';
import { Badge, TONE_TEXT } from '@/ui/Chip';
import { CutText } from '@/ui/CutText';
import { cx } from '@/ui/cx';

import { KindIcon, SEVERITY_TONE, formatCount, kindLabel } from './labels';

export interface ResultListProps {
  issues: readonly IssueDto[];
  selectedId: string | null;
  label: string;
  onSelect: (issue: IssueDto) => void;
  onOpen: (issue: IssueDto) => void;
  onHighlight: (findingId: string | null) => void;
}

const rowId = (issue: IssueDto) => `result-${issue.id}`;

/** One issue: its kind, where it is, and the text, cut where readers lose it. */
function ResultRow({ issue, selected }: { issue: IssueDto; selected: boolean }) {
  const [first] = issue.instances;
  if (!first) return null;
  const places = issue.instances.length;
  const tone = SEVERITY_TONE[issue.severity];
  return (
    <div
      className={cx(
        'flex flex-col gap-1 rounded-control px-2.5 py-2',
        'transition-[background-color] duration-(--duration-press)',
        selected ? 'bg-accent-soft' : 'hover:bg-surface',
      )}
    >
      {/* Wraps rather than squeezing: badge, place and count each keep their text. */}
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <Badge tone={tone} icon={<KindIcon kind={issue.kind} />}>
          {kindLabel(issue.kind)}
        </Badge>
        <span
          className="min-w-0 flex-1 basis-24 truncate font-mono text-small text-fg-muted"
          title={first.element.label}
          translate="no"
        >
          {first.element.label}
        </span>
        {places > 1 && (
          <span className="shrink-0 text-small text-fg-muted tabular-nums">
            {i18n.t('results.places', places, [formatCount(places)])}
          </span>
        )}
      </span>
      {first.cut ? (
        <CutText
          className="line-clamp-2"
          title={`${first.cut.visible}${first.cut.hidden}`}
          visible={first.cut.visible}
          hidden={first.cut.hidden}
          visibleLabel={i18n.t('detail.visible')}
          hiddenLabel={i18n.t('detail.lost')}
          toneClass={TONE_TEXT[tone]}
        />
      ) : (
        first.text !== '' && (
          <span className="line-clamp-2 break-words" title={first.text}>
            {first.text}
          </span>
        )
      )}
    </div>
  );
}

/**
 * A virtualized listbox: thousands of results stay fast, and the selection
 * moves with j/k or the arrow keys (plan §5.7). Moving the selection
 * highlights the element on the page, like hovering does.
 */
/** Rows animate in only on arrival: never again while scrolling the virtual list. */
const ARRIVAL_MS = 500;
const STAGGERED_ROWS = 8;

/**
 * Remount it (with a `key`) when a new set of results arrives, so the first
 * rows stagger in once. Filtering and scrolling never replay it.
 */
export function ResultList({
  issues,
  selectedId,
  label,
  onSelect,
  onOpen,
  onHighlight,
}: ResultListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns fresh functions each render, so the React Compiler
  // lint rule flags it; this component doesn't rely on compiler memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });
  const selectedIndex = issues.findIndex((issue) => issue.id === selectedId);
  const [arriving, setArriving] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setArriving(false);
    }, ARRIVAL_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (selectedIndex >= 0) virtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
  }, [selectedIndex, virtualizer]);

  const move = (index: number) => {
    const issue = issues[Math.max(0, Math.min(issues.length - 1, index))];
    if (!issue) return;
    onSelect(issue);
    onHighlight(issue.instances[0]?.id ?? null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'j':
        move(selectedIndex + 1);
        break;
      case 'ArrowUp':
      case 'k':
        move(selectedIndex <= 0 ? 0 : selectedIndex - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(issues.length - 1);
        break;
      case 'Enter': {
        const issue = issues[selectedIndex];
        if (issue) onOpen(issue);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  const selected = issues[selectedIndex];
  return (
    <div
      ref={scrollRef}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={selected ? rowId(selected) : undefined}
      onKeyDown={onKeyDown}
      onFocus={() => {
        if (selectedIndex < 0) move(0);
      }}
      onMouseLeave={() => {
        onHighlight(null);
      }}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-card bg-raised p-1 shadow-raised focus-visible:outline-offset-[-2px]"
    >
      <div
        role="presentation"
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const issue = issues[item.index];
          if (!issue) return null;
          return (
            // Options aren't focusable in the aria-activedescendant pattern: the
            // listbox holds focus and handles the keys (see onKeyDown above).
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
            <div
              key={issue.id}
              id={rowId(issue)}
              ref={virtualizer.measureElement}
              data-index={item.index}
              role="option"
              aria-selected={issue.id === selectedId}
              aria-setsize={issues.length}
              aria-posinset={item.index + 1}
              className="absolute inset-x-0 top-0 cursor-default"
              style={{ transform: `translateY(${String(item.start)}px)` }}
              onMouseEnter={() => {
                onHighlight(issue.instances[0]?.id ?? null);
              }}
              onClick={() => {
                onSelect(issue);
                onOpen(issue);
              }}
            >
              <div
                className={cx(arriving && item.index < STAGGERED_ROWS && 'animate-enter')}
                style={
                  arriving
                    ? { animationDelay: `${String(Math.min(item.index, STAGGERED_ROWS) * 20)}ms` }
                    : undefined
                }
              >
                <ResultRow issue={issue} selected={issue.id === selectedId} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
