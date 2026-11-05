import { i18n } from '#i18n';
import {
  Ban,
  Command as CommandIcon,
  Crosshair,
  ExternalLink,
  Keyboard,
  Monitor,
  Moon,
  RotateCcw,
  ScanText,
  Search,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Sun,
  WholeWord,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';

import type { Command } from '@/features/commands/CommandPalette';
import { CommandPalette } from '@/features/commands/CommandPalette';
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
import { BrandMark } from '@/ui/BrandMark';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Kbd } from '@/ui/Kbd';
import { useToast } from '@/ui/Toast';
import { useMediaQuery } from '@/ui/use-media-query';

const ICON = { size: 16, strokeWidth: 1.5 } as const;

/** ⌘ on macOS, Ctrl elsewhere. */
const modKey = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl ';

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
  const [commandsOpen, setCommandsOpen] = useState(false);
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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandsOpen((open) => !open);
        return;
      }
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

  // Rebuilt every render (it's small), so it always reflects the current state.
  const commands: Command[] = (() => {
    const actions = i18n.t('commands.groupActions');
    const results = i18n.t('commands.groupResults');
    const viewGroup = i18n.t('commands.groupView');
    const help = i18n.t('commands.groupHelp');
    const list: (Command | false)[] = [
      !busy &&
        !noTab && {
          id: 'scan',
          group: actions,
          label: hasResults ? i18n.t('actions.scanAgain') : i18n.t('actions.scan'),
          icon: <ScanText {...ICON} />,
          run: scan,
        },
      !busy &&
        !noTab && {
          id: 'stress',
          group: actions,
          label: i18n.t('commands.runStress'),
          icon: <WholeWord {...ICON} />,
          keywords: 'translation pseudo locale longer text',
          run: stress,
        },
      !noTab && {
        id: 'stress-options',
        group: actions,
        label: i18n.t('commands.stressOptions'),
        icon: <SlidersHorizontal {...ICON} />,
        run: () => {
          setStressOpen(true);
        },
      },
      !busy &&
        !noTab && {
          id: 'inspect',
          group: actions,
          label: state.picking ? i18n.t('actions.stopInspecting') : i18n.t('actions.inspect'),
          icon: <Crosshair {...ICON} />,
          keywords: 'pick element breaking point',
          run: pick,
        },
      state.stressActive && {
        id: 'revert',
        group: actions,
        label: i18n.t('actions.revert'),
        icon: <RotateCcw {...ICON} />,
        keywords: 'undo restore',
        run: () => void controller.revert(),
      },
      busy && {
        id: 'cancel',
        group: actions,
        label: i18n.t('actions.cancel'),
        icon: <Ban {...ICON} />,
        run: () => {
          controller.cancel();
        },
      },
      hasResults && {
        id: 'search',
        group: results,
        label: i18n.t('commands.search'),
        icon: <Search {...ICON} />,
        keys: ['/'],
        // Looked up when run: commands are built during render, where refs aren't read.
        run: () => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(),
      },
      {
        id: 'settings',
        group: viewGroup,
        label: i18n.t('actions.settings'),
        icon: <SettingsIcon {...ICON} />,
        run: () => {
          setView('settings');
        },
      },
      ...(
        [
          ['system', i18n.t('commands.themeSystem'), <Monitor key="m" {...ICON} />],
          ['light', i18n.t('commands.themeLight'), <Sun key="s" {...ICON} />],
          ['dark', i18n.t('commands.themeDark'), <Moon key="d" {...ICON} />],
        ] as const
      )
        .filter(([theme]) => theme !== settings.theme)
        .map(([theme, label, icon]) => ({
          id: `theme-${theme}`,
          group: viewGroup,
          label,
          icon,
          keywords: 'appearance color mode',
          run: () => {
            updateSettings({ theme });
          },
        })),
      {
        id: 'shortcuts',
        group: help,
        label: i18n.t('actions.shortcuts'),
        icon: <Keyboard {...ICON} />,
        keys: ['?'],
        run: () => {
          setShortcutsOpen(true);
        },
      },
      {
        id: 'demo',
        group: help,
        label: i18n.t('actions.demo'),
        icon: <ExternalLink {...ICON} />,
        run: demo,
      },
      {
        id: 'change-shortcut',
        group: help,
        label: i18n.t('commands.changeShortcut'),
        icon: <ExternalLink {...ICON} />,
        run: () => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' }),
      },
    ];
    return list.filter((command): command is Command => command !== false);
  })();

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
        <span className="text-accent">
          <BrandMark />
        </span>
        <h1 className="min-w-0 flex-1 text-title font-semibold">{i18n.t('extName')}</h1>
        <button
          type="button"
          onClick={() => {
            setCommandsOpen(true);
          }}
          aria-keyshortcuts={modKey === '⌘' ? 'Meta+K' : 'Control+K'}
          className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-control border border-line bg-raised px-2 text-small text-fg-muted transition-[border-color,color] duration-(--duration-press) hover:border-line-strong hover:text-fg"
        >
          <CommandIcon size={14} strokeWidth={1.5} aria-hidden="true" />
          {/* On narrow panels the label is only read out, so the title keeps one line. */}
          <span className="sr-only min-[360px]:not-sr-only">{i18n.t('commands.open')}</span>
          <span aria-hidden="true">
            <Kbd>{modKey}K</Kbd>
          </span>
        </button>
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
      <CommandPalette open={commandsOpen} onOpenChange={setCommandsOpen} commands={commands} />
    </div>
  );
}
