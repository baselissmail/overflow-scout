import { useCallback, useEffect, useState } from 'react';

import type { Settings } from '@/storage/settings';
import { DEFAULT_SETTINGS, normalizeSettings, settingsItem } from '@/storage/settings';

/** Settings from storage, kept in sync across open panels; changes save immediately. */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let current = true;
    void settingsItem.getValue().then((value) => {
      if (current) setSettings(normalizeSettings(value));
    });
    const unwatch = settingsItem.watch((value) => {
      setSettings(normalizeSettings(value));
    });
    return () => {
      current = false;
      unwatch();
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = normalizeSettings({ ...previous, ...patch });
      void settingsItem.setValue(next);
      return next;
    });
  }, []);

  return [settings, update];
}

/** Applies the theme: `system` follows the OS, the others override it. */
export function applyTheme(theme: Settings['theme']): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset['theme'];
  else root.dataset['theme'] = theme;
}
