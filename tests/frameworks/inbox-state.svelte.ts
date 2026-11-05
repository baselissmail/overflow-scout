import type { InboxState } from './scenario';

/** Deeply reactive Svelte state, so updates re-render the mounted component. */
export function createInboxState(initial: InboxState): InboxState {
  const state = $state(structuredClone(initial));
  return state;
}
