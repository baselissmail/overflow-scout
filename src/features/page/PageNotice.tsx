import { i18n } from '#i18n';
import type { ReactNode } from 'react';
import { browser } from 'wxt/browser';

import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';

import type { PanelController, PanelState } from './controller';
import { useOpenShortcut } from './use-open-shortcut';

interface PageNoticeProps {
  state: PanelState;
  controller: PanelController;
  onDemo: () => void;
  onScan: () => void;
  onAccessGranted: (origin: string) => void;
}

function Notice({
  tone,
  message,
  action,
}: {
  tone: 'neutral' | 'critical';
  message: string;
  action?: ReactNode;
}) {
  return (
    <section
      role={tone === 'critical' ? 'alert' : 'status'}
      className={cx(
        'flex animate-enter flex-col items-start gap-2 rounded-card border p-3',
        tone === 'critical' ? 'border-critical bg-critical-soft' : 'border-line bg-surface',
      )}
    >
      <p>{message}</p>
      {action}
    </section>
  );
}

/** Every dead end explains itself and offers the one action that helps (plan §5.4). */
export function PageNotice({
  state,
  controller,
  onDemo,
  onScan,
  onAccessGranted,
}: PageNoticeProps) {
  const shortcut = useOpenShortcut();
  const { failure } = state;

  if (state.connection === 'unavailable' && failure) {
    switch (failure.reason) {
      case 'restricted':
        return (
          <Notice
            tone="neutral"
            message={i18n.t('page.restricted')}
            action={
              <Button size="sm" onClick={onDemo}>
                {i18n.t('actions.openDemo')}
              </Button>
            }
          />
        );
      case 'file-access':
        return <Notice tone="neutral" message={i18n.t('page.fileAccess')} />;
      case 'no-access': {
        const { origin } = failure;
        return (
          <Notice
            tone="neutral"
            message={
              shortcut ? i18n.t('page.noAccessShortcut', [shortcut]) : i18n.t('page.noAccess')
            }
            // Chrome reveals the URL only in some errors; otherwise it's offered once connected.
            action={
              origin && (
                <Button
                  size="sm"
                  onClick={() => {
                    // Must run inside the click: Chrome only prompts during a user gesture.
                    void browser.permissions
                      .request({ origins: [`${origin}/*`] })
                      .then((granted) => {
                        if (!granted) return;
                        onAccessGranted(new URL(origin).host);
                        onScan();
                      });
                  }}
                >
                  {i18n.t('actions.alwaysAllow')}
                </Button>
              )
            }
          />
        );
      }
      case 'error':
        return (
          <Notice
            tone="critical"
            message={i18n.t('page.error', [failure.message])}
            action={
              <Button size="sm" onClick={onScan}>
                {i18n.t('actions.retry')}
              </Button>
            }
          />
        );
    }
  }

  if (state.error) {
    return (
      <Notice
        tone="critical"
        message={i18n.t('page.error', [state.error])}
        action={
          <Button
            size="sm"
            onClick={() => {
              controller.dismissError();
            }}
          >
            {i18n.t('actions.close')}
          </Button>
        }
      />
    );
  }

  if (state.stale && state.busy === null) {
    return (
      <Notice
        tone="neutral"
        message={i18n.t('page.stale')}
        action={
          <Button size="sm" onClick={onScan}>
            {i18n.t('actions.scanAgain')}
          </Button>
        }
      />
    );
  }

  return null;
}
