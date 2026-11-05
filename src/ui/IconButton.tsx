import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Tooltip } from './Tooltip';
import { cx } from './cx';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name and tooltip text: icon-only buttons always have both. */
  label: string;
  icon: ReactNode;
}

export function IconButton({ label, icon, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <Tooltip content={label}>
      <button
        type={type}
        aria-label={label}
        className={cx(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-control text-fg-muted',
          'transition-[background-color,color] duration-(--duration-press) ease-(--ease-out)',
          'hover:bg-surface hover:text-fg disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
      </button>
    </Tooltip>
  );
}
