import { flushSync, mount, unmount } from 'svelte';

import Inbox from './Inbox.svelte';
import { createInboxState } from './inbox-state.svelte';
import type { MountInbox } from './scenario';
import { describeFrameworkSafety } from './scenario';

const mountSvelte: MountInbox = (target, initial) => {
  const state = createInboxState(initial);
  const component = mount(Inbox, { target, props: { state } });
  flushSync();
  return Promise.resolve({
    update: (next) => {
      Object.assign(state, structuredClone(next));
      flushSync();
      return Promise.resolve();
    },
    unmount: () => {
      void unmount(component);
    },
  });
};

describeFrameworkSafety('Svelte 5', mountSvelte);
