import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';

import { cx } from './cx';

export interface SelectFieldProps<T extends string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value'
> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** A labelled native select: accessible and keyboard-friendly everywhere. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  ...props
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className={cx('flex min-w-0 flex-col gap-1', className)}>
      <label htmlFor={id} className="text-small text-fg-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value as T);
        }}
        className="min-h-8 w-full rounded-control border border-line-strong px-2 py-1"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
