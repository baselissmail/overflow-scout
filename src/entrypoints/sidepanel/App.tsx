import { i18n } from '#i18n';
import {
  Ban,
  ClipboardCopy,
  Command as CommandIcon,
  Crosshair,
  Eraser,
  ExternalLink,
  FileJson,
  House,
  Keyboard,
  ListChecks,
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';

import type { Command } from '@/features/commands/CommandPalette';
import { CommandPalette } from '@/features/commands/CommandPalette';
import { Home } from '@/features/home/Home';
import { InspectCard } from '@/features/inspect/InspectCard';
import { PageNotice } from '@/features/page/PageNotice';
import { ScanProgress } from '@/features/page/ScanProgress';
import { SiteAccess } from '@/features/page/SiteAccess';
import { usePanel } from '@/features/page/use-panel';
import { downloadText, exportResults } from '@/features/report/export';
import { ResultsView } from '@/features/results/ResultsView';
import { ignoredOn, useIgnoreRules } from '@/features/results/use-ignore';
import { SettingsView } from '@/features/settings/SettingsView';
import { applyTheme, useSettings } from '@/features/settings/use-settings';
import { ShortcutsDialog } from '@/features/shortcuts/ShortcutsDialog';
import { StressBar } from '@/features/stress/StressBar';
import type { StressScope } from '@/features/stress/StressControls';
import { StressControls } from '@/features/stress/StressControls';
import type { TextValueDto } from '@/messaging/protocol';
import { siteOf } from '@/storage/ignore';
import { BrandMark } from '@/ui/BrandMark';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Kbd } from '@/ui/Kbd';
import { cx } from '@/ui/cx';
import { useToast } from '@/ui/Toast';
import { useMediaQuery } from '@/ui/use-media-query';

const ICON = { size: 16, strokeWidth: 1.5 } as const;
const SMALL_ICON = { size: 14, strokeWidth: 1.5 } as const;

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
  const ignore = useIgnoreRules();
  const tryText = useCallback(
    (value: TextValueDto | null) => controller.tryText(value),
    [controller],
  );
  const textOf = useCallback(() => controller.textOf(), [controller]);
  const ignoredIds = ignoredOn(ignore.rules, state.page ? siteOf(state.page.url) : null);
  useEffect(() => {
    // The toolbar badge counts what the panel shows: ignored issues are left out.
    controller.setIgnored(ignoredIds);
  }, [controller, ignoredIds]);
  const [view, setView] = useState<'main' | 'settings'>('main');
  // Asked for Home while there are results; any new action leaves it again.
  const [home, setHome] = useState(false);
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
  // Home is the start screen, and where the Home button leads: never while work is under way.
  const atHome = !busy && !stressOpen && !state.picking && !state.picked && (home || !hasResults);
  const shownIssues =
    state.showing === 'scan'
      ? state.scan?.issues
      : state.showing === 'stress' && state.stress
        ? [...state.stress.brokenNow, ...state.stress.atRisk]
        : undefined;
  const resultCount = shownIssues
    ? shownIssues.filter((issue) => !ignoredIds.has(issue.id)).length
    : null;

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Confirm every revert, from the panel or from the page's own button.
  const restored = state.restored;
  useEffect(() => {
    if (restored) toast(i18n.t('toast.restored', restored.texts, [String(restored.texts)]));
  }, [restored, toast]);

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

  const scan = () => {
    setHome(false);
    void controller.scan(settings.includeInputs);
  };
  const stress = () => {
    // The results need the room; the revert bar shows that stress is on.
    setHome(false);
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
  /** One click, the saved defaults; a second click puts the page back. */
  const toggleStress = () => {
    if (state.stressActive) void controller.revert();
    else stress();
  };
  /** The start screen. Results stay (Home leads back to them); stress text stays until reverted. */
  const goHome = () => {
    setView('main');
    setHome(true);
    setStressOpen(false);
    if (state.picking) void controller.pick(false);
    if (state.picked) controller.closeInspect();
  };
  const toResults = () => {
    setHome(false);
  };
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
          // The names people may know it by.
          keywords: 'stress test translation pseudo locale expand',
          run: stress,
        },
      !noTab && {
        id: 'stress-options',
        group: actions,
        label: i18n.t('commands.stressOptions'),
        icon: <SlidersHorizontal {...ICON} />,
        keywords: 'stress test strategy intensity settings',
        run: () => {
          setHome(false);
          setStressOpen(true);
        },
      },
      !busy &&
        !noTab && {
          id: 'inspect',
          group: actions,
          label: state.picking ? i18n.t('actions.stopInspecting') : i18n.t('actions.inspect'),
          icon: <Crosshair {...ICON} />,
          keywords: 'inspect pick element fit breaking point',
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
      hasResults && {
        id: 'copy-report',
        group: results,
        label: i18n.t('commands.copyReport'),
        icon: <ClipboardCopy {...ICON} />,
        keywords: 'export markdown github jira bug',
        run: () => {
          const exported = exportResults(state, ignoredIds);
          if (!exported) return;
          void navigator.clipboard.writeText(exported.markdown).then(() => {
            toast(i18n.t('report.copied'));
          });
        },
      },
      hasResults && {
        id: 'save-json',
        group: results,
        label: i18n.t('commands.saveJson'),
        icon: <FileJson {...ICON} />,
        keywords: 'export download data',
        run: () => {
          const exported = exportResults(state, ignoredIds);
          if (exported) downloadText(exported.jsonName, exported.json, 'application/json');
        },
      },
      hasResults &&
        !busy && {
          id: 'clear-results',
          group: results,
          label: i18n.t('actions.clearResults'),
          icon: <Eraser {...ICON} />,
          run: () => {
            controller.clearResults();
          },
        },
      !atHome && {
        id: 'home',
        group: viewGroup,
        label: i18n.t('commands.home'),
        icon: <House {...ICON} />,
        keywords: 'start main back',
        run: goHome,
      },
      hasResults &&
        atHome && {
          id: 'results',
          group: viewGroup,
          label: i18n.t('home.results'),
          icon: <ListChecks {...ICON} />,
          run: toResults,
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
          ignore={ignore}
          onBack={() => {
            setView('main');
          }}
        />
      </div>
    );
  }

  return (
    // One scroll for the whole panel, used only when the controls leave the results
    // too little room (narrow panels, long translations); the list keeps its own.
    <div className="flex h-dvh flex-col overflow-y-auto">
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-1 bg-canvas px-3 pt-3 pb-2">
        {/* The name leads Home, as on most sites; the house button says so in plain sight. */}
        <h1 className="min-w-0 flex-1 text-title font-semibold">
          <button
            type="button"
            onClick={goHome}
            aria-current={atHome ? 'page' : undefined}
            className="-ms-1.5 inline-flex max-w-full items-center gap-2 rounded-control px-1.5 py-0.5 text-start transition-[background-color] duration-(--duration-press) ease-(--ease-out) hover:bg-surface"
          >
            <span className="shrink-0 text-accent">
              <BrandMark />
            </span>
            {/* Wraps rather than truncates: the panel's own rule, checked by its self-test. */}
            <span className="min-w-0 break-words">{i18n.t('extName')}</span>
          </button>
        </h1>
        <IconButton
          label={i18n.t('actions.home')}
          icon={<House {...ICON} />}
          aria-current={atHome ? 'page' : undefined}
          className="aria-[current=page]:bg-surface aria-[current=page]:text-fg"
          onClick={goHome}
        />
        <button
          type="button"
          onClick={() => {
            setCommandsOpen(true);
          }}
          aria-keyshortcuts={modKey === '⌘' ? 'Meta+K' : 'Control+K'}
          className="ms-1 inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-control border border-line bg-raised px-2 text-small text-fg-muted transition-[border-color,color] duration-(--duration-press) hover:border-line-strong hover:text-fg"
        >
          <CommandIcon
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
            className="hidden min-[360px]:block"
          />
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

      <div className="flex shrink-0 flex-col gap-3 px-3 pb-3">
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

        {!atHome && (hasResults || stressOpen || state.picking || state.picked) && (
          // One primary action; the two modes are quiet until they're on.
          <div className="flex flex-wrap items-center gap-1">
            <Button
              // While stress text is on, Revert (in the stress bar) is the main action.
              variant={state.stressActive ? 'secondary' : 'primary'}
              size="sm"
              icon={<ScanText {...SMALL_ICON} />}
              disabled={busy || noTab}
              onClick={scan}
              className="me-1"
            >
              {hasResults ? i18n.t('actions.scanAgain') : i18n.t('actions.scan')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<WholeWord {...SMALL_ICON} />}
              // On while longer text is on the page; pressing it again puts the text back.
              aria-pressed={state.stressActive}
              disabled={busy || noTab}
              className="text-fg-muted hover:text-fg aria-pressed:bg-accent-soft aria-pressed:text-fg"
              onClick={toggleStress}
            >
              {/* Words, not a bare icon: on narrow panels the row wraps instead. */}
              {i18n.t('actions.stressShort')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Crosshair {...SMALL_ICON} />}
              aria-pressed={state.picking}
              disabled={busy || noTab}
              className="text-fg-muted hover:text-fg aria-pressed:bg-accent-soft aria-pressed:text-fg"
              onClick={pick}
            >
              {state.picking ? i18n.t('actions.stopInspecting') : i18n.t('actions.inspectShort')}
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
            strategy={state.stressOptions?.strategy ?? settings.strategy}
            pending={state.pending}
            busy={busy}
            optionsOpen={stressOpen}
            onRevert={() => void controller.revert()}
            onReapply={() => void controller.reapply()}
            onOptions={() => {
              setHome(false);
              setStressOpen((open) => !open);
            }}
          />
        )}

        <InspectCard
          picking={state.picking}
          picked={state.picked}
          onClose={() => {
            controller.closeInspect();
          }}
          onCancelPick={() => void controller.pick(false)}
          onTryText={tryText}
          onTextOf={textOf}
        />
      </div>

      <div
        className={cx(
          'flex flex-1 flex-col px-3 pb-3',
          hasResults && !atHome ? 'min-h-96' : 'min-h-0',
        )}
      >
        {atHome ? (
          <div className="min-h-0 overflow-y-auto">
            <Home
              disabled={noTab}
              resultCount={hasResults ? resultCount : null}
              onResults={toResults}
              onScan={scan}
              onStress={stress}
              onInspect={pick}
              onDemo={demo}
            />
          </div>
        ) : (
          hasResults && (
            <ResultsView
              state={state}
              controller={controller}
              ignore={ignore}
              wide={wide}
              searchRef={searchRef}
              onRunStress={stress}
            />
          )
        )}
      </div>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <CommandPalette open={commandsOpen} onOpenChange={setCommandsOpen} commands={commands} />
    </div>
  );
}
