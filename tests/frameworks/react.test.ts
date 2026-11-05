import { createElement as h } from 'react';
import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import type { InboxState, MountInbox } from './scenario';
import { describeFrameworkSafety } from './scenario';

function Inbox(state: InboxState): ReactElement {
  return h(
    'section',
    { className: 'inbox' },
    h('h1', null, state.title),
    h('p', { className: 'summary' }, 'You have ', state.unread, ' unread messages'),
    h(
      'ul',
      null,
      state.items.map((item) => h('li', { key: item.id, 'data-id': item.id }, item.label)),
    ),
    state.filtersActive ? h('p', { className: 'filters' }, 'Filters are active') : null,
    h('input', { className: 'search', placeholder: state.searchPlaceholder }),
    h('input', { type: 'submit', value: state.sendLabel }),
    h('button', { type: 'button' }, 'Archive all'),
  );
}

const mountReact: MountInbox = (target, state) => {
  const root = createRoot(target);
  flushSync(() => {
    root.render(h(Inbox, state));
  });
  return Promise.resolve({
    update: (next) => {
      flushSync(() => {
        root.render(h(Inbox, next));
      });
      return Promise.resolve();
    },
    unmount: () => {
      root.unmount();
    },
  });
};

describeFrameworkSafety('React 19', mountReact);
