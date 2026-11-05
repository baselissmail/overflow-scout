import { Toast as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { createContext, use, useCallback, useMemo, useState } from 'react';

interface ToastMessage {
  id: number;
  text: string;
}

const ToastContext = createContext<(text: string) => void>(() => undefined);

/** Toasts are for async outcomes only; local actions confirm inline (plan §5.6). */
export function useToast(): (text: string) => void {
  return use(ToastContext);
}

export function ToastProvider({ label, children }: { label: string; children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const show = useCallback((text: string) => {
    setToasts((current) => [...current.slice(-2), { id: Date.now() + Math.random(), text }]);
  }, []);
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext value={value}>
      <Primitive.Provider label={label} duration={4000}>
        {children}
        {toasts.map((toast) => (
          <Primitive.Root
            key={toast.id}
            onOpenChange={(open) => {
              if (!open) setToasts((current) => current.filter((item) => item.id !== toast.id));
            }}
            className="animate-enter rounded-card bg-fg px-3 py-2 text-canvas shadow-float"
          >
            <Primitive.Description>{toast.text}</Primitive.Description>
          </Primitive.Root>
        ))}
        <Primitive.Viewport className="fixed inset-x-3 bottom-3 z-50 flex flex-col gap-2 outline-none" />
      </Primitive.Provider>
    </ToastContext>
  );
}
