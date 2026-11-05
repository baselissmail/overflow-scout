import { createApp, h, nextTick, reactive } from 'vue';

import type { InboxState, MountInbox } from './scenario';
import { describeFrameworkSafety } from './scenario';

const mountVue: MountInbox = async (target, initial) => {
  const state = reactive<InboxState>(structuredClone(initial));
  const app = createApp({
    render: () =>
      h('section', { class: 'inbox' }, [
        h('h1', state.title),
        h('p', { class: 'summary' }, `You have ${String(state.unread)} unread messages`),
        h(
          'ul',
          state.items.map((item) => h('li', { key: item.id, 'data-id': item.id }, item.label)),
        ),
        state.filtersActive ? h('p', { class: 'filters' }, 'Filters are active') : null,
        h('input', { class: 'search', placeholder: state.searchPlaceholder }),
        h('input', { type: 'submit', value: state.sendLabel }),
        h('button', { type: 'button' }, 'Archive all'),
      ]),
  });
  app.mount(target);
  await nextTick();
  return {
    update: async (next) => {
      Object.assign(state, structuredClone(next));
      await nextTick();
    },
    unmount: () => {
      app.unmount();
    },
  };
};

describeFrameworkSafety('Vue 3', mountVue);
