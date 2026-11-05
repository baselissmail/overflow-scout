import { i18n } from '#i18n';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

/**
 * The connected page's site, with "Always allow on this site" (plan §2.2).
 * Access from a toolbar click ends when the tab moves to another site; a
 * per-site grant lets the panel keep working there without another click.
 * The origin is only known once the panel has access, so it's offered here.
 */
export function SiteAccess({ url, onGranted }: { url: string; onGranted: (host: string) => void }) {
  const origin = /^https?:/.test(url) ? new URL(url).origin : null;
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!origin) return;
    let current = true;
    void browser.permissions.contains({ origins: [`${origin}/*`] }).then((value) => {
      if (current) setGranted(value);
    });
    return () => {
      current = false;
    };
  }, [origin]);

  if (!origin) return null;
  return (
    <p className="flex flex-wrap items-center justify-between gap-2 text-small text-fg-muted">
      <span className="truncate font-mono">{new URL(origin).host}</span>
      {granted === false && (
        <button
          type="button"
          className="rounded-control border border-line bg-canvas px-2 py-0.5 font-medium text-fg"
          onClick={() => {
            // Must run inside the click: Chrome only prompts during a user gesture.
            void browser.permissions.request({ origins: [`${origin}/*`] }).then((value) => {
              setGranted(value);
              if (value) onGranted(new URL(origin).host);
            });
          }}
        >
          {i18n.t('actions.alwaysAllow')}
        </button>
      )}
      {granted === true && <span>{i18n.t('page.alwaysAllowed')}</span>}
    </p>
  );
}
