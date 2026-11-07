import { ToggleGroup } from 'radix-ui';

import { cx } from './cx';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Medium for a main control of the panel; small inside forms. */
  size?: 'md' | 'sm';
  disabled?: boolean;
  className?: string;
}

/** Single choice among a few options, shown at once (arrow keys move between them). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'sm',
  disabled = false,
  className,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        // Radix sends '' when the active item is pressed again; keep a value selected.
        if (next) onChange(next as T);
      }}
      className={cx(
        'flex min-w-0 gap-0.5 rounded-control bg-surface',
        size === 'md' ? 'p-1' : 'p-0.5',
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cx(
            // flex-auto, not flex-1: a zero basis would size the group to its narrowest word.
            'flex-auto rounded-[5px] px-2 font-medium text-fg-muted',
            size === 'md' ? 'min-h-8 py-1' : 'min-h-6 py-0.5 text-small',
            'transition-[background-color,color] duration-(--duration-press) ease-(--ease-out)',
            'hover:text-fg disabled:opacity-50',
            'data-[state=on]:bg-raised data-[state=on]:text-fg data-[state=on]:shadow-raised',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
