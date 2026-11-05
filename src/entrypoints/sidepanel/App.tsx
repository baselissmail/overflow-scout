import { i18n } from '#i18n';
import { Crosshair, Keyboard, ScanText, Settings as SettingsIcon, WholeWord } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';

import { Home } from '@/features/home/Home';
import { InspectCard } from '@/features/inspect/InspectCard';
import { PageNotice } from '@/features/page/PageNotice';
import { ScanProgress } from '@/features/page/ScanProgress';
import { SiteAccess } from '@/features/page/SiteAccess';
import { usePanel } from '@/features/page/use-panel';
import { ResultsView } from '@/features/results/ResultsView';
import { SettingsView } from '@/features/settings/SettingsView';
import { applyTheme, useSettings } from '@/features/settings/use-settings';
import { ShortcutsDialog } from '@/features/shortcuts/ShortcutsDialog';
import { StressBar } from '@/features/stress/StressBar';
import type { StressScope } from '@/features/stress/StressControls';
import { StressControls } from '@/features/stress/StressControls';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { useToast } from '@/ui/Toast';
import { useMediaQuery } from '@/ui/use-media-query';

const ICON = { size: 16, strokeWidth: 1.5 } as const;

/** True when a key press is meant for a text field, not a shortcut. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function App() {
  const { state, controller } = usePanel();
  const [settings, updateSettings] = useSettings();
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [stressOpen, setStressOpen] = useState(false);
  const [scope, setScope] = useState<StressScope>('page');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const wide = useMediaQuery('(min-width: 520px)');
  const searchRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const busy = state.busy !== null || state.connection === 'connecting';
  // A picked element is the only region a stress test can be scoped to.
  const effectiveScope: StressScope = state.picked ? scope : 'page';
  const noTab = state.tabId === null;
  const hasResults = state.showing !== null;

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (state.revertedOnPage > 0) toast(i18n.t('toast.revertedOnPage'));
  }, [state.revertedOnPage, toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const typing = isTyping(event.target);
      if (event.key === 'Escape' && state.picking) {
        void controller.pick(false);
      } else if (!typing && event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      } else if (!typing && event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (!typing && (event.key === 'j' || event.key === 'k')) {
        const list = document.querySelector<HTMLElement>('[role="listbox"]');
        if (list && document.activeElement !== list) {
          event.preventDefault();
          list.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [controller, state.picking]);

  const scan = () => void controller.scan(settings.includeInputs);
  const stress = () => {
    // The results need the room; the revert bar shows that stress is on.
    setStressOpen(false);
    void controller.stress(
      {
        strategy: settings.strategy,
        intensity: settings.intensity,
        language: settings.language,
        rtl: settings.rtl,
      },
      effectiveScope,
      settings.includeInputs,
    );
  };
  const pick = () => void controller.pick(!state.picking);
  const demo = () => void browser.tabs.create({ url: browser.runtime.getURL('/demo.html') });

  if (view === 'settings') {
    return (
      <div className="h-dvh overflow-y-auto">
        <SettingsView
          settings={settings}
          onSettings={updateSettings}
          onBack={() => {
            setView('main');
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <h1 className="min-w-0 flex-1 text-title font-semibold">{i18n.t('extName')}</h1>
        <IconButton
          label={i18n.t('actions.shortcuts')}
          icon={<Keyboard {...ICON} />}
          onClick={() => {
            setShortcutsOpen(true);
          }}
        />
        <IconButton
          label={i18n.t('actions.settings')}
          icon={<SettingsIcon {...ICON} />}
          onClick={() => {
            setView('settings');
          }}
        />
      </header>

      <div className="flex max-h-[60dvh] shrink-0 flex-col gap-3 overflow-y-auto px-3 pb-3">
        {state.page && (
          <SiteAccess
            url={state.page.url}
            onGranted={(host) => {
              toast(i18n.t('page.accessGranted', [host]));
            }}
          />
        )}
        <PageNotice
          state={state}
          controller={controller}
          onDemo={demo}
          onScan={scan}
          onAccessGranted={(host) => {
            toast(i18n.t('page.accessGranted', [host]));
          }}
        />

        {(hasResults || stressOpen || state.picking || state.picked) && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon={<ScanText {...ICON} />}
              disabled={busy || noTab}
              onClick={scan}
            >
              {hasResults ? i18n.t('actions.scanAgain') : i18n.t('actions.scan')}
            </Button>
            <Button
              icon={<WholeWord {...ICON} />}
              aria-pressed={stressOpen}
              aria-expanded={stressOpen}
              disabled={noTab}
              className="aria-pressed:border-accent aria-pressed:bg-accent-soft"
              onClick={() => {
                setStressOpen((open) => !open);
              }}
            >
              {i18n.t('actions.stress')}
            </Button>
            <Button
              icon={<Crosshair {...ICON} />}
              aria-pressed={state.picking}
              disabled={busy || noTab}
              className="aria-pressed:border-accent aria-pressed:bg-accent-soft"
              onClick={pick}
            >
              {state.picking ? i18n.t('actions.stopInspecting') : i18n.t('actions.inspect')}
            </Button>
          </div>
        )}

        {busy && (
          <ScanProgress
            state={state}
            onCancel={() => {
              controller.cancel();
            }}
          />
        )}

        {stressOpen && (
          <StressControls
            settings={settings}
            onSettings={updateSettings}
            scope={effectiveScope}
            onScope={setScope}
            canScopeToPicked={state.picked !== null}
            busy={busy}
            onApply={stress}
          />
        )}

        {state.stressActive && state.stress && (
          <StressBar
            growth={state.stress.stats.stress.growth}
            strings={state.stress.stats.stress.strings}
            pending={state.pending}
            busy={busy}
            onRevert={() => void controller.revert()}
            onReapply={() => void controller.reapply()}
          />
        )}

        <InspectCard picking={state.picking} picked={state.picked} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
        {hasResults ? (
          <ResultsView
            state={state}
            controller={controller}
            wide={wide}
            searchRef={searchRef}
            onRunStress={() => {
              setStressOpen(true);
            }}
          />
        ) : (
          !busy &&
          !stressOpen &&
          !state.picking &&
          !state.picked && (
            <div className="min-h-0 overflow-y-auto">
              <p className="mb-3 text-fg-muted">{i18n.t('tagline')}</p>
              <Home
                disabled={noTab}
                onScan={scan}
                onStress={() => {
                  setStressOpen(true);
                }}
                onInspect={pick}
                onDemo={demo}
              />
            </div>
          )
        )}
      </div>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
