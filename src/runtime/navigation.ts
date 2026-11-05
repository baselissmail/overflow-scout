export type NavigationKind = 'push' | 'replace' | 'traverse' | 'reload';

/** Hash routers put the route after `#/` (or `#!/`); a plain `#id` is an anchor. */
const isRoute = (hash: string) => /^#!?\//.test(hash);

/**
 * Whether a same-document navigation shows a different page, so results and
 * stress text no longer describe it (single-page apps change routes with
 * `history.pushState`). A new query counts when pushed (page 2 of a list) but
 * not when replaced (a search box keeping the URL in sync); a new hash counts
 * only for hash routes, not anchors.
 */
export function isNewPage(from: string, to: string, kind: NavigationKind): boolean {
  if (kind === 'reload') return true;
  const before = new URL(from);
  const after = new URL(to);
  if (before.origin !== after.origin || before.pathname !== after.pathname) return true;
  if (before.search !== after.search) return kind !== 'replace';
  if (before.hash !== after.hash) return isRoute(before.hash) || isRoute(after.hash);
  return false;
}

/**
 * Calls `listener` when the page changes route without loading a new document.
 * A real load ends the port instead. Uses the Navigation API, which sees
 * `pushState`, `replaceState`, hash changes and back/forward alike.
 */
export function watchNavigation(view: Window, listener: () => void): () => void {
  // Chrome has had the Navigation API since 102; the extension needs 142.
  const { navigation } = view;
  const onChange = (event: NavigationCurrentEntryChangeEvent) => {
    const to = navigation.currentEntry?.url;
    const from = event.from.url;
    if (!to || !from || event.navigationType === null) return;
    if (isNewPage(from, to, event.navigationType)) listener();
  };
  navigation.addEventListener('currententrychange', onChange);
  return () => {
    navigation.removeEventListener('currententrychange', onChange);
  };
}
