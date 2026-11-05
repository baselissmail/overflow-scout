import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

/**
 * The keyboard shortcut that opens the panel, as the user has it set: null when
 * none is set, undefined while Chrome hasn't answered yet (so nothing claims
 * "no shortcut" before it knows).
 */
export function useOpenShortcut(): string | null | undefined {
  const [shortcut, setShortcut] = useState<string | null | undefined>(undefined);
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
