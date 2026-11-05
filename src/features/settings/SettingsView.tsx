import { i18n } from '#i18n';
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import { browser } from 'wxt/browser';

import { useOpenShortcut } from '@/features/page/use-open-shortcut';
import { kindLabel } from '@/features/results/labels';
import type { IgnoreRules } from '@/features/results/use-ignore';
import { StressOptionFields } from '@/features/stress/StressOptionFields';
import type { Settings, Theme } from '@/storage/settings';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Kbd } from '@/ui/Kbd';
import { Segmented } from '@/ui/Segmented';
import { Switch } from '@/ui/Switch';
import { interpolate } from '@/ui/interpolate';

const ICON = { size: 16, strokeWidth: 1.5 } as const;

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="flex flex-col gap-2" aria-labelledby={id}>
      <div className="px-1">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {description && <p className="text-small text-fg-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-3 rounded-card bg-raised p-3 shadow-raised">{children}</div>
    </section>
  );
}

/** Sites granted "Always allow"; required permissions (e2e builds) aren't listed. */
function useGrantedSites(): [string[], (origin: string) => void] {
  const [sites, setSites] = useState<string[]>([]);
  const refresh = useCallback(() => {
    const manifest = browser.runtime.getManifest() as { host_permissions?: string[] };
    const required = new Set(manifest.host_permissions ?? []);
    void browser.permissions.getAll().then((all) => {
      setSites((all.origins ?? []).filter((origin) => !required.has(origin)).sort());
    });
  }, []);
  useEffect(() => {
    refresh();
    browser.permissions.onAdded.addListener(refresh);
    browser.permissions.onRemoved.addListener(refresh);
    return () => {
      browser.permissions.onAdded.removeListener(refresh);
      browser.permissions.onRemoved.removeListener(refresh);
    };
  }, [refresh]);
  const remove = (origin: string) => {
    void browser.permissions.remove({ origins: [origin] }).then(refresh);
  };
  return [sites, remove];
}

const hostOf = (pattern: string) => pattern.replace(/^\w+:\/\//, '').replace(/\/\*$/, '');

/** A rule's site as people know it. */
function siteName(site: string): string {
  if (site === 'file://') return i18n.t('settings.localFiles');
  if (site.startsWith('chrome-extension://')) return i18n.t('settings.demoPage');
  return hostOf(site);
}

interface SettingsViewProps {
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
  onBack: () => void;
  ignore: IgnoreRules;
}

export function SettingsView({ settings, onSettings, onBack, ignore }: SettingsViewProps) {
  const [sites, removeSite] = useGrantedSites();
  const shortcut = useOpenShortcut();
  const { version } = browser.runtime.getManifest();

  return (
    <main className="flex flex-col gap-5 p-3" aria-labelledby="settings-title">
      <header className="flex items-center gap-2">
        <IconButton
          label={i18n.t('actions.back')}
          icon={<ArrowLeft {...ICON} className="rtl:rotate-180" />}
          onClick={onBack}
        />
        <h1 id="settings-title" className="text-title font-semibold">
          {i18n.t('settings.heading')}
        </h1>
      </header>

      <Group title={i18n.t('settings.appearance')}>
        <div className="flex flex-col gap-1">
          <span className="text-small text-fg-muted">{i18n.t('settings.theme')}</span>
          <Segmented<Theme>
            label={i18n.t('settings.theme')}
            value={settings.theme}
            onChange={(theme) => {
              onSettings({ theme });
            }}
            options={[
              { value: 'system', label: i18n.t('settings.themeSystem') },
              { value: 'light', label: i18n.t('settings.themeLight') },
              { value: 'dark', label: i18n.t('settings.themeDark') },
            ]}
          />
        </div>
      </Group>

      <Group title={i18n.t('settings.defaults')}>
        <StressOptionFields settings={settings} onSettings={onSettings} />
        <Switch
          label={i18n.t('stress.rtl')}
          description={i18n.t('stress.rtlDescription')}
          checked={settings.rtl}
          onChange={(rtl) => {
            onSettings({ rtl });
          }}
        />
      </Group>

      <Group title={i18n.t('settings.scanning')}>
        <Switch
          label={i18n.t('settings.includeInputs')}
          description={i18n.t('settings.includeInputsDescription')}
          checked={settings.includeInputs}
          onChange={(includeInputs) => {
            onSettings({ includeInputs });
          }}
        />
      </Group>

      <Group title={i18n.t('settings.ignored')} description={i18n.t('settings.ignoredDescription')}>
        {ignore.rules.length === 0 ? (
          <p className="text-fg-muted">{i18n.t('settings.ignoredNone')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ignore.rules.map((rule) => (
              <li
                key={`${rule.site} ${rule.issueId}`}
                className="flex items-start justify-between gap-2"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-small">
                    {kindLabel(rule.kind)} · {siteName(rule.site)}
                  </span>
                  <span className="font-mono text-small break-all text-fg-muted" translate="no">
                    {rule.label}
                  </span>
                </span>
                <IconButton
                  label={i18n.t('settings.unignore', [rule.label])}
                  icon={<Trash2 {...ICON} />}
                  onClick={() => {
                    ignore.unignore(rule.site, rule.issueId);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Group>

      <Group title={i18n.t('settings.sites')} description={i18n.t('settings.sitesDescription')}>
        {sites.length === 0 ? (
          <p className="text-fg-muted">{i18n.t('settings.sitesNone')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {sites.map((origin) => (
              <li key={origin} className="flex items-center justify-between gap-2">
                <span className="min-w-0 font-mono text-small break-all" translate="no">
                  {hostOf(origin)}
                </span>
                <IconButton
                  label={i18n.t('settings.removeSite', [hostOf(origin)])}
                  icon={<Trash2 {...ICON} />}
                  onClick={() => {
                    removeSite(origin);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Group>

      <Group title={i18n.t('settings.shortcut')}>
        {/* Nothing until Chrome answers, so it never claims "no shortcut" by mistake. */}
        <p className="min-h-[1lh]">
          {shortcut === undefined
            ? null
            : shortcut
              ? interpolate(
                  (slot) => i18n.t('settings.shortcutCurrent', [slot]),
                  <Kbd>{shortcut}</Kbd>,
                )
              : i18n.t('settings.shortcutNone')}
        </p>
        <Button
          size="sm"
          className="self-start"
          icon={<ExternalLink {...ICON} />}
          onClick={() => {
            void browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
          }}
        >
          {i18n.t('settings.changeShortcut')}
        </Button>
      </Group>

      <Group title={i18n.t('settings.about')}>
        <p className="tabular-nums">{i18n.t('settings.version', [version])}</p>
        <p className="text-fg-muted">{i18n.t('settings.privacy')}</p>
        <p className="text-fg-muted">{i18n.t('settings.credit')}</p>
      </Group>
    </main>
  );
}
