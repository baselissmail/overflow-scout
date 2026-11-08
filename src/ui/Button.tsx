import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent/90',
  // A raised surface on a hairline: quiet next to the one primary action.
  secondary: 'bg-raised text-fg shadow-raised hover:bg-surface',
  ghost: 'text-fg hover:bg-surface',
  danger: 'bg-fg text-canvas hover:bg-fg/85',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: ReactNode;
}

/**
 * Labels may wrap (the panel must survive its own stress test), so buttons
 * set a minimum height instead of a fixed one. Targets are at least 24 px.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-control text-start font-medium',
        'transition-[background-color,border-color,color,transform] duration-(--duration-press) ease-(--ease-out)',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        size === 'md' ? 'min-h-8 px-3 py-1' : 'min-h-7 px-2.5 py-0.5 text-small',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {icon !== undefined && (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
