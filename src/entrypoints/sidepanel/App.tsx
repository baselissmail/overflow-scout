import { i18n } from '#i18n';
import { useState } from 'react';
import { browser } from 'wxt/browser';

import { InspectCard } from '@/features/inspect/InspectCard';
import { PageNotice } from '@/features/page/PageNotice';
import { SiteAccess } from '@/features/page/SiteAccess';
import type { Busy } from '@/features/page/controller';
import { usePanel } from '@/features/page/use-panel';
import { Results } from '@/features/results/Results';
import { StressBar, StressControls } from '@/features/stress/StressControls';

const BUSY_LABEL: Readonly<Record<Busy, () => string>> = {
  connect: () => i18n.t('busy.connecting'),
  scan: () => i18n.t('busy.scanning'),
  stress: () => i18n.t('busy.stressing'),
  revert: () => i18n.t('busy.reverting'),
  reapply: () => i18n.t('busy.stressing'),
};

const actionClass =
  'rounded-control border border-line bg-canvas px-3 py-1.5 font-medium hover:bg-surface disabled:opacity-60 aria-pressed:border-accent aria-pressed:text-accent';

export function App() {
  const { state, controller } = usePanel();
  const [stressOpen, setStressOpen] = useState(false);
  const busy = state.busy !== null || state.connection === 'connecting';
  const busyLabel =
    state.connection === 'connecting'
      ? BUSY_LABEL.connect()
      : state.busy && BUSY_LABEL[state.busy]();

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-semibold">{i18n.t('extName')}</h1>
        <p className="text-fg-muted">{i18n.t('tagline')}</p>
      </header>

      {state.page && <SiteAccess url={state.page.url} />}
      <PageNotice state={state} controller={controller} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={actionClass}
          disabled={busy || state.tabId === null}
          onClick={() => {
            void controller.scan();
          }}
        >
          {state.scan ? i18n.t('actions.scanAgain') : i18n.t('actions.scan')}
        </button>
        <button
          type="button"
          className={actionClass}
          aria-pressed={stressOpen}
          disabled={state.tabId === null}
          onClick={() => {
            setStressOpen((open) => !open);
          }}
        >
          {i18n.t('actions.stress')}
        </button>
        <button
          type="button"
          className={actionClass}
          aria-pressed={state.picking}
          disabled={busy || state.tabId === null}
          onClick={() => {
            void controller.pick(!state.picking);
          }}
        >
          {state.picking ? i18n.t('actions.stopInspecting') : i18n.t('actions.inspect')}
        </button>
      </div>

      {stressOpen && (
        <StressControls
          busy={busy}
          onApply={(options) => {
            void controller.stress(options);
          }}
        />
      )}

      {state.stressActive && state.stress && (
        <StressBar
          growth={state.stress.stats.stress.growth}
          strings={state.stress.stats.stress.strings}
          pending={state.pending}
          busy={busy}
          onRevert={() => {
            void controller.revert();
          }}
          onReapply={() => {
            void controller.reapply();
          }}
        />
      )}

      <InspectCard picking={state.picking} picked={state.picked} />

      <p className="text-fg-muted" role="status" aria-live="polite">
        {busyLabel}
      </p>

      <Results
        scan={state.scan}
        stress={state.stress}
        showing={state.showing}
        onHighlight={(findingId) => {
          controller.highlight(findingId);
        }}
        onReveal={(findingId) => {
          void controller.reveal(findingId);
        }}
      />

      <footer className="mt-auto pt-2">
        <button
          type="button"
          className="text-accent underline underline-offset-2"
          onClick={() => {
            void browser.tabs.create({ url: browser.runtime.getURL('/demo.html') });
          }}
        >
          {i18n.t('actions.demo')}
        </button>
      </footer>
    </main>
  );
}
