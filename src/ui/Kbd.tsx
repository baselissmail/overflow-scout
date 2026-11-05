import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded-[4px] border border-line-strong px-1 font-mono text-small text-fg">
      {children}
    </kbd>
  );
}
