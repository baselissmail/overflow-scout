import { i18n } from '#i18n';
import { CornerDownLeft, Search } from 'lucide-react';
import { Dialog as Primitive } from 'radix-ui';
import type { KeyboardEvent, ReactNode } from 'react';
import { useId, useMemo, useState } from 'react';

import { Kbd } from '@/ui/Kbd';
import { cx } from '@/ui/cx';

export interface Command {
  id: string;
  label: string;
  group: string;
  icon: ReactNode;
  /** Keys shown next to the command, e.g. ["/"]. */
  keys?: readonly string[];
  /** Extra words that find it, e.g. "dark light appearance". */
  keywords?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only commands that apply right now; the palette never shows dead ends. */
  commands: readonly Command[];
}

function matches(command: Command, query: string): boolean {
  const haystack = `${command.label} ${command.group} ${command.keywords ?? ''}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * Every action in one keyboard-first list (⌘K / Ctrl+K), Raycast style.
 * A standard combobox: the field keeps focus, arrows move the active option,
 * Enter runs it, Esc closes.
 */
export function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const shown = useMemo(
    () => commands.filter((command) => matches(command, query)),
    [commands, query],
  );
  const groups = useMemo(() => {
    const byGroup = new Map<string, Command[]>();
    for (const command of shown)
      byGroup.set(command.group, [...(byGroup.get(command.group) ?? []), command]);
    return [...byGroup.entries()];
  }, [shown]);
  const current = shown[Math.min(active, shown.length - 1)];
  const optionId = (command: Command) => `${id}-${command.id}`;

  const close = () => {
    onOpenChange(false);
    setQuery('');
    setActive(0);
  };
  const run = (command: Command) => {
    close();
    // Let the dialog close and return focus before the command moves it.
    requestAnimationFrame(() => {
      command.run();
    });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      setActive((index) => (shown.length === 0 ? 0 : (index + 1) % shown.length));
    } else if (event.key === 'ArrowUp') {
      setActive((index) => (shown.length === 0 ? 0 : (index - 1 + shown.length) % shown.length));
    } else if (event.key === 'Enter' && current) {
      run(current);
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <Primitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
    >
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Primitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-2 top-10 z-50 flex max-h-[calc(100dvh-56px)] animate-enter flex-col overflow-hidden rounded-card bg-raised shadow-float"
        >
          <Primitive.Title className="sr-only">{i18n.t('commands.title')}</Primitive.Title>
          <div className="flex items-center gap-2 border-b border-line px-3 focus-within:border-accent">
            <Search
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              className="shrink-0 text-fg-muted"
            />
            <input
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-activedescendant={current ? optionId(current) : undefined}
              aria-label={i18n.t('commands.title')}
              autoComplete="off"
              spellCheck={false}
              placeholder={i18n.t('commands.placeholder')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="min-h-11 w-full bg-transparent outline-none placeholder:text-fg-muted"
            />
          </div>
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label={i18n.t('commands.title')}
            className="min-h-0 overflow-y-auto overscroll-contain p-1"
          >
            {groups.length === 0 && (
              <p className="px-2 py-3 text-fg-muted">{i18n.t('commands.none')}</p>
            )}
            {groups.map(([group, items]) => (
              <div key={group} role="group" aria-label={group} className="flex flex-col">
                <span aria-hidden="true" className="px-2 pt-2 pb-1 text-small text-fg-muted">
                  {group}
                </span>
                {items.map((command) => {
                  const selected = command === current;
                  return (
                    // Options aren't focusable in the aria-activedescendant pattern; the field
                    // keeps focus and handles the keys.
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
                    <div
                      key={command.id}
                      id={optionId(command)}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => {
                        setActive(shown.indexOf(command));
                      }}
                      onClick={() => {
                        run(command);
                      }}
                      className={cx(
                        'flex min-h-8 cursor-default items-center gap-2.5 rounded-control px-2',
                        selected ? 'bg-accent-soft' : '',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cx('shrink-0', selected ? 'text-accent' : 'text-fg-muted')}
                      >
                        {command.icon}
                      </span>
                      <span className="min-w-0 flex-1">{command.label}</span>
                      {command.keys && (
                        <span className="flex shrink-0 gap-1">
                          {command.keys.map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </span>
                      )}
                      {selected && (
                        <CornerDownLeft
                          size={14}
                          strokeWidth={1.5}
                          aria-hidden="true"
                          className="shrink-0 text-fg-muted"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
