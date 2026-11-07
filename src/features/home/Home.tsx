import { i18n } from '#i18n';
import { ChevronRight, Crosshair, ListChecks, ScanText, WholeWord } from 'lucide-react';
import type { ReactNode } from 'react';

import { useOpenShortcut } from '@/features/page/use-open-shortcut';
import { Button } from '@/ui/Button';
import { Kbd } from '@/ui/Kbd';
import { interpolate } from '@/ui/interpolate';

import { DEMO_SOURCE, DEMO_TRANSLATION, OverflowDemo } from './OverflowDemo';

interface HomeProps {
  disabled: boolean;
  /** Results kept from the last scan or test (ignored ones left out), or null. */
  resultCount: number | null;
  onResults: () => void;
  onScan: () => void;
  onStress: () => void;
  onInspect: () => void;
  onDemo: () => void;
}

const ICON = { size: 16, strokeWidth: 1.5 } as const;

/** A secondary action: one line of what it does, not another card. */
function Row({
  icon,
  title,
  body,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex w-full items-center gap-3 px-3 py-2.5 text-start transition-[background-color] duration-(--duration-press) hover:bg-surface disabled:opacity-50"
    >
      <span aria-hidden="true" className="shrink-0 text-accent">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-small text-fg-muted">{body}</span>
      </span>
      <ChevronRight
        {...ICON}
        aria-hidden="true"
        className="shrink-0 text-fg-muted transition-transform duration-(--duration-press) group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
      />
    </button>
  );
}

/**
 * First run and no results yet. It shows the idea before asking for anything:
 * the demo, one primary action, and the two others as rows (plan §5.3).
 */
export function Home({
  disabled,
  resultCount,
  onResults,
  onScan,
  onStress,
  onInspect,
  onDemo,
}: HomeProps) {
  const shortcut = useOpenShortcut();
  return (
    <section className="flex flex-col gap-4" aria-labelledby="home-title">
      {resultCount !== null && (
        // Coming Home never throws results away: the way back is the first thing here.
        <div className="overflow-hidden rounded-card bg-raised shadow-raised">
          <Row
            icon={<ListChecks {...ICON} />}
            title={i18n.t('home.results')}
            body={i18n.t('home.resultsBody', resultCount, [String(resultCount)])}
            disabled={false}
            onClick={onResults}
          />
        </div>
      )}
      <div className="flex flex-col gap-3 rounded-card bg-raised p-3 shadow-raised">
        {/* What it's for, then the idea shown, then what the button does. */}
        <h2 id="home-title" className="text-title font-semibold text-balance">
          {i18n.t('tagline')}
        </h2>
        <figure className="flex flex-col gap-1.5">
          <OverflowDemo />
          <figcaption className="text-small text-fg-muted">
            {i18n.t('home.demoCaption', [DEMO_SOURCE, DEMO_TRANSLATION])}
          </figcaption>
        </figure>
        <p className="text-pretty text-fg-muted">{i18n.t('home.scan')}</p>
        <Button
          variant="primary"
          className="self-start"
          icon={<ScanText {...ICON} />}
          disabled={disabled}
          onClick={onScan}
        >
          {i18n.t('actions.scan')}
        </Button>
      </div>

      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-card bg-raised shadow-raised">
        <Row
          icon={<WholeWord {...ICON} />}
          title={i18n.t('actions.stress')}
          body={i18n.t('home.stress')}
          disabled={disabled}
          onClick={onStress}
        />
        <Row
          icon={<Crosshair {...ICON} />}
          title={i18n.t('actions.inspect')}
          body={i18n.t('home.inspect')}
          disabled={disabled}
          onClick={onInspect}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-accent underline decoration-accent/40 underline-offset-[3px] hover:decoration-accent"
          onClick={onDemo}
        >
          {i18n.t('actions.demo')}
        </button>
        {shortcut && (
          <span className="text-small text-fg-muted">
            {interpolate((slot) => i18n.t('home.shortcut', [slot]), <Kbd>{shortcut}</Kbd>)}
          </span>
        )}
      </div>
    </section>
  );
}
