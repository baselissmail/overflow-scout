import { i18n } from '#i18n';
import {
  Ban,
  ClipboardCopy,
  ExternalLink,
  FileDown,
  FileJson,
  Keyboard,
  Monitor,
  Moon,
  MousePointerClick,
  ScanText,
  Search,
  Settings as SettingsIcon,
  Sun,
  WholeWord,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';

import { ControlDeck } from '@/features/check/ControlDeck';
import type { TextLength } from '@/features/check/length';
import { TEXT_LENGTHS, lengthLabel, stressOptions } from '@/features/check/length';
import type { Command } from '@/features/commands/CommandPalette';
import { CommandPalette } from '@/features/commands/CommandPalette';
import { PageNotice } from '@/features/page/PageNotice';
import { ScanProgress } from '@/features/page/ScanProgress';
import { SiteAccess } from '@/features/page/SiteAccess';
import { usePanel } from '@/features/page/use-panel';
import { downloadText, exportResults } from '@/features/report/export';
import {
  ProblemList,
  ProblemView,
  shownResults,
  useIgnoring,
} from '@/features/results/ResultsView';
import { useIgnoreRules } from '@/features/results/use-ignore';
import { SettingsView } from '@/features/settings/SettingsView';
import { applyTheme, useSettings } from '@/features/settings/use-settings';
import { ShortcutsDialog } from '@/features/shortcuts/ShortcutsDialog';
import { PickedView } from '@/features/try/PickedView';
import type { PickedElement, TextValueDto } from '@/messaging/protocol';
import { BrandMark } from '@/ui/BrandMark';
import { IconButton } from '@/ui/IconButton';
import { useToast } from '@/ui/Toast';

const ICON = { size: 16, strokeWidth: 1.5 } as const;

/** True when a key press is meant for a text field, not a shortcut. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** A key per pick, so trying text starts over for each element. */
const pickKeys = new WeakMap<PickedElement, number>();
let nextPickKey = 0;
function pickKey(picked: PickedElement): number {
  let key = pickKeys.get(picked);
  if (key === undefined) {
    nextPickKey += 1;
    key = nextPickKey;
    pickKeys.set(picked, key);
  }
  return key;
}

/**
 * One main screen (check the page, try your own text, set the text length,
 * and the problems found), and three views one step in from it: a problem,
 * your own text in a picked element, and Settings. Each step in has a Back
 * link in the same place, and Esc does the same.
 */
export function App() {
  const { state, controller } = usePanel();
  const [settings, updateSettings] = useSettings();
  const ignore = useIgnoreRules();
  const ignoring = useIgnoring(ignore, state);
  const tryText = useCallback(
    (value: TextValueDto | null) => controller.tryText(value),
    [controller],
  );
  const textOf = useCallback(() => controller.textOf(), [controller]);
  useEffect(() => {
    // The toolbar badge counts what the panel shows: ignored problems are left out.
    controller.setIgnored(ignoring.ids);
  }, [controller, ignoring.ids]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // The length asked for, shown while the page gets there.
  const [requested, setRequested] = useState<TextLength>('normal');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const busy = state.busy !== null || state.connection === 'connecting';
  const noTab = state.tabId === null;
  const shown = shownResults(state);
  const hasResults = shown !== null;
  const openIssue = shown?.issues.find((issue) => issue.id === openId) ?? null;
  const intensity = state.stressOptions?.intensity;
  const actual: TextLength = !state.stressActive
    ? 'normal'
    : intensity === 'realistic'
      ? 'realistic'
      : 'worst';
  const changing = state.busy === 'stress' || state.busy === 'revert';
  const length = changing ? requested : actual;

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Confirm every revert, from the panel or from the page's own button.
  const restored = state.restored;
  useEffect(() => {
    if (restored) toast(i18n.t('toast.restored', restored.texts, [String(restored.texts)]));
  }, [restored, toast]);

  /** Back to the main screen from wherever the panel is. */
  const toMain = useCallback(() => {
    setSettingsOpen(false);
    setOpenId(null);
    controller.highlight(null);
    if (state.picking) void controller.pick(false);
    if (state.picked) controller.closeInspect();
  }, [controller, state.picking, state.picked]);

  const check = (to: TextLength = actual) => {
    setOpenId(null);
    setSelectedId(null);
    setRequested(to);
    if (to === 'normal') {
      // The controller checks the page again once its text is back.
      if (state.stressActive) void controller.revert();
      else void controller.scan(settings.includeInputs);
    } else {
      void controller.stress(stressOptions(to), 'page', settings.includeInputs);
    }
  };
  const setLength = (to: TextLength) => {
    if (to === actual) return;
    // Back to normal with nothing checked yet: put the text back, nothing more to show.
    if (to === 'normal' && !hasResults) {
      setRequested(to);
      void controller.revert();
      return;
    }
    check(to);
  };
  const pick = () => {
    setOpenId(null);
    void controller.pick(true);
  };
  const demo = () => void browser.tabs.create({ url: browser.runtime.getURL('/demo.html') });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandsOpen((open) => !open);
        return;
      }
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (commandsOpen || shortcutsOpen) return;
      const typing = isTyping(event.target);
      if (event.key === 'Escape') {
        if (state.picking || state.picked || openId !== null || settingsOpen) {
          event.preventDefault();
          toMain();
        }
      } else if (!typing && event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      } else if (!typing && event.key === '/' && searchRef.current) {
        event.preventDefault();
        searchRef.current.focus();
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
  }, [commandsOpen, shortcutsOpen, state.picking, state.picked, openId, settingsOpen, toMain]);

  // Rebuilt every render (it's small), so it always reflects the current state.
  const commands: Command[] = (() => {
    const actions = i18n.t('commands.groupActions');
    const results = i18n.t('commands.groupResults');
    const viewGroup = i18n.t('commands.groupView');
    const help = i18n.t('commands.groupHelp');
    const exported = () => exportResults(state, ignoring.ids);
    const list: (Command | false)[] = [
      !busy &&
        !noTab && {
          id: 'scan',
          group: actions,
          label: hasResults ? i18n.t('actions.scanAgain') : i18n.t('actions.scan'),
          icon: <ScanText {...ICON} />,
          run: () => {
            toMain();
            check();
          },
        },
      ...TEXT_LENGTHS.filter((value) => value !== actual).map(
        (value): Command | false =>
          !busy &&
          !noTab && {
            id: `length-${value}`,
            group: actions,
            label:
              value === 'normal'
                ? i18n.t('commands.lengthNormal')
                : value === 'realistic'
                  ? i18n.t('commands.lengthRealistic')
                  : i18n.t('commands.lengthWorst'),
            icon: <WholeWord {...ICON} />,
            // The names people may know it by.
            keywords: `${lengthLabel(value)} stress test translation expand revert undo`,
            run: () => {
              toMain();
              setLength(value);
            },
          },
      ),
      !busy &&
        !noTab && {
          id: 'try',
          group: actions,
          label: i18n.t('actions.tryText'),
          icon: <MousePointerClick {...ICON} />,
          keywords: 'pick element measure inspect fit',
          run: () => {
            toMain();
            pick();
          },
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
        run: () => {
          toMain();
          // Looked up when run: the field shows only for long lists.
          requestAnimationFrame(() =>
            document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(),
          );
        },
      },
      hasResults && {
        id: 'copy-report',
        group: results,
        label: i18n.t('commands.copyReport'),
        icon: <ClipboardCopy {...ICON} />,
        keywords: 'export markdown github jira bug',
        run: () => {
          const report = exported();
          if (!report) return;
          void navigator.clipboard.writeText(report.markdown).then(() => {
            toast(i18n.t('report.copied'));
          });
        },
      },
      hasResults && {
        id: 'save-markdown',
        group: results,
        label: i18n.t('commands.saveMarkdown'),
        icon: <FileDown {...ICON} />,
        keywords: 'export download file',
        run: () => {
          const report = exported();
          if (report) downloadText(report.markdownName, report.markdown, 'text/markdown');
        },
      },
      hasResults && {
        id: 'save-json',
        group: results,
        label: i18n.t('commands.saveJson'),
        icon: <FileJson {...ICON} />,
        keywords: 'export download data',
        run: () => {
          const report = exported();
          if (report) downloadText(report.jsonName, report.json, 'application/json');
        },
      },
      {
        id: 'settings',
        group: viewGroup,
        label: i18n.t('actions.settings'),
        icon: <SettingsIcon {...ICON} />,
        run: () => {
          toMain();
          setSettingsOpen(true);
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
        label: i18n.t('commands.shortcuts'),
        icon: <Keyboard {...ICON} />,
        keys: ['?'],
        run: () => {
          setShortcutsOpen(true);
        },
      },
      {
        id: 'demo',
        group: help,
        label: i18n.t('commands.demo'),
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

  // Which view: the main screen, or one step in from it.
  let body: ReactNode;
  if (settingsOpen) {
    body = (
      <SettingsView
        settings={settings}
        onSettings={updateSettings}
        ignore={ignore}
        onBack={toMain}
        onShortcuts={() => {
          setShortcutsOpen(true);
        }}
        onDemo={demo}
      />
    );
  } else if (state.picked) {
    body = (
      <PickedView
        key={pickKey(state.picked)}
        picked={state.picked}
        onBack={toMain}
        onPickAnother={pick}
        onTryText={tryText}
        onTextOf={textOf}
      />
    );
  } else if (openIssue && shown) {
    body = (
      <ProblemView
        state={state}
        controller={controller}
        issue={openIssue}
        shown={shown}
        ignoring={ignoring}
        onBack={() => {
          setOpenId(null);
          controller.highlight(null);
        }}
      />
    );
  } else {
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {!hasResults && !busy && (
          <div className="flex flex-col gap-1">
            <h2 className="text-title font-semibold">{i18n.t('start.title')}</h2>
            <p className="text-pretty text-fg-muted">{i18n.t('start.body')}</p>
          </div>
        )}
        <PageNotice
          state={state}
          controller={controller}
          onDemo={demo}
          onScan={() => {
            check();
          }}
          onAccessGranted={(host) => {
            toast(i18n.t('page.accessGranted', [host]));
          }}
        />
        <ControlDeck
          length={length}
          hasResults={hasResults}
          busy={busy}
          disabled={noTab}
          picking={state.picking}
          pending={state.pending}
          onCheck={() => {
            check();
          }}
          onLength={setLength}
          onPick={pick}
          onCancelPick={() => void controller.pick(false)}
          onReapply={() => void controller.reapply()}
        />
        {busy ? (
          <ScanProgress
            state={state}
            onCancel={() => {
              controller.cancel();
            }}
          />
        ) : (
          shown && (
            <ProblemList
              state={state}
              shown={shown}
              ignoring={ignoring}
              query={query}
              onQuery={setQuery}
              searchRef={searchRef}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOpen={(issue) => {
                setSelectedId(issue.id);
                setOpenId(issue.id);
                const first = issue.instances[0];
                if (first) void controller.reveal(first.id);
              }}
              controller={controller}
            />
          )
        )}
        {/* A page Chrome won't allow already offers the demo, in its notice. */}
        {!hasResults && !busy && state.connection !== 'unavailable' && (
          <p className="mt-auto text-small text-fg-muted">
            {i18n.t('start.demo')}{' '}
            <button
              type="button"
              onClick={demo}
              className="font-medium text-accent underline decoration-accent/40 underline-offset-[3px] hover:decoration-accent"
            >
              {i18n.t('actions.openDemo')}
            </button>
          </p>
        )}
        {state.page && (
          <SiteAccess
            url={state.page.url}
            onGranted={(host) => {
              toast(i18n.t('page.accessGranted', [host]));
            }}
          />
        )}
      </div>
    );
  }

  return (
    // One scroll for the panel; a long list scrolls inside itself so the controls stay put.
    <div className="flex h-dvh flex-col overflow-y-auto">
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-2 bg-canvas px-4 pt-3 pb-2">
        <h1 className="min-w-0 flex-1 text-title font-semibold">
          {/* The name leads back to the main screen, as on most sites. */}
          <button
            type="button"
            onClick={toMain}
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
          label={i18n.t('actions.settings')}
          icon={<SettingsIcon {...ICON} />}
          aria-current={settingsOpen ? 'page' : undefined}
          className="aria-[current=page]:bg-surface aria-[current=page]:text-fg"
          onClick={() => {
            toMain();
            setSettingsOpen(true);
          }}
        />
      </header>

      <main className="flex min-h-96 flex-1 flex-col px-4 pt-2 pb-4">{body}</main>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <CommandPalette open={commandsOpen} onOpenChange={setCommandsOpen} commands={commands} />
    </div>
  );
}
