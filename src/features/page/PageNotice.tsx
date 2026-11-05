import { i18n } from '#i18n';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

import type { PanelController, PanelState } from './controller';

const noticeClass = 'flex flex-col gap-2 rounded-card border p-3';

interface PageNoticeProps {
  state: PanelState;
  controller: PanelController;
}

/** Explains why the panel can't work on a page, with the one action that helps (plan §5.4). */
export function PageNotice({ state, controller }: PageNoticeProps) {
  const { failure } = state;

  if (state.connection === 'unavailable' && failure) {
    switch (failure.reason) {
      case 'restricted':
        return (
          <section className={`${noticeClass} border-line bg-surface`} role="status">
            <p>{i18n.t('page.restricted')}</p>
          </section>
        );
      case 'file-access':
        return (
          <section className={`${noticeClass} border-line bg-surface`} role="status">
            <p>{i18n.t('page.fileAccess')}</p>
          </section>
        );
      case 'no-access':
        return <NoAccess origin={failure.origin} controller={controller} />;
      case 'error':
        return (
          <section className={`${noticeClass} border-critical bg-critical-soft`} role="alert">
            <p>{i18n.t('page.error', [failure.message])}</p>
          </section>
        );
    }
  }

  if (state.error) {
    return (
      <section className={`${noticeClass} border-critical bg-critical-soft`} role="alert">
        <p>{i18n.t('page.error', [state.error])}</p>
        <button
          type="button"
          className="self-start rounded-control border border-line bg-canvas px-2 py-1 font-medium"
          onClick={() => {
            controller.dismissError();
          }}
        >
          {i18n.t('actions.retry')}
        </button>
      </section>
    );
  }

  if (state.stale) {
    return (
      <section className={`${noticeClass} border-line bg-surface`} role="status">
        <p>{i18n.t('page.stale')}</p>
      </section>
    );
  }

  return null;
}

/** The keyboard shortcut that opens the panel, as the user has it set (or none). */
function useOpenShortcut(): string | null {
  const [shortcut, setShortcut] = useState<string | null>(null);
  useEffect(() => {
    void browser.commands.getAll().then((commands) => {
      const open = commands.find((command) => command.name === '_execute_action');
      // An unset shortcut is reported as an empty string.
      const value = open?.shortcut;
      setShortcut(value === undefined || value === '' ? null : value);
    });
  }, []);
  return shortcut;
}

function NoAccess({ origin, controller }: { origin: string | null; controller: PanelController }) {
  const shortcut = useOpenShortcut();
  return (
    <section className={`${noticeClass} border-line bg-surface`} role="status">
      <p>{shortcut ? i18n.t('page.noAccessShortcut', [shortcut]) : i18n.t('page.noAccess')}</p>
      {/* Chrome reveals the URL only in some errors; otherwise it's offered once connected. */}
      {origin && (
        <button
          type="button"
          className="self-start rounded-control border border-line bg-canvas px-2 py-1 font-medium"
          onClick={() => {
            // Must run inside the click: Chrome only prompts during a user gesture.
            void browser.permissions.request({ origins: [`${origin}/*`] }).then(async (granted) => {
              if (granted) await controller.scan();
            });
          }}
        >
          {i18n.t('actions.alwaysAllow')}
        </button>
      )}
    </section>
  );
}
