import { X } from 'lucide-react';
import { Dialog as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';

import { IconButton } from './IconButton';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

/** A modal sheet: focus is trapped while open and returns to the trigger on close. */
export function Dialog({ open, onOpenChange, title, closeLabel, children }: DialogProps) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Primitive.Content
          aria-describedby={undefined}
          // Focus the dialog itself, not the close button: focusing the button
          // would show its tooltip, and the first Esc would only close that.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          tabIndex={-1}
          className="fixed inset-x-2 top-12 z-50 max-h-[calc(100dvh-64px)] animate-enter overflow-y-auto overscroll-contain rounded-card bg-canvas p-3 shadow-float"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Primitive.Title className="text-title font-semibold">{title}</Primitive.Title>
            <Primitive.Close asChild>
              <IconButton label={closeLabel} icon={<X size={16} strokeWidth={1.5} />} />
            </Primitive.Close>
          </div>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
