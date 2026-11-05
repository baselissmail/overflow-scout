import { Popover as Primitive } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';

export function Popover({
  trigger,
  label,
  children,
}: {
  trigger: ReactElement;
  /** Accessible name of the popover content. */
  label: string;
  children: ReactNode;
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          aria-label={label}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 w-72 max-w-[calc(100vw-16px)] animate-enter rounded-card bg-canvas p-3 shadow-float"
        >
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
