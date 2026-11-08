import { useCallback, useState } from 'react';

/**
 * Panel state kept for each tab, so a tab comes back as it was left: the
 * problem that was open, the row that was selected, the search.
 */
export function usePerTab<T>(tabId: number | null, initial: T): [T, (value: T) => void] {
  const [values, setValues] = useState<ReadonlyMap<number | null, { value: T }>>(() => new Map());
  const value = values.get(tabId)?.value ?? initial;
  const set = useCallback(
    (next: T) => {
      setValues((previous) => new Map(previous).set(tabId, { value: next }));
    },
    [tabId],
  );
  return [value, set];
}
