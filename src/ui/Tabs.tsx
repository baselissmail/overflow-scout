import { Tabs as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';

export const Tabs = Primitive.Root;
export const TabsContent = Primitive.Content;

export function TabsList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Primitive.List aria-label={label} className="flex border-b border-line">
      {children}
    </Primitive.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Primitive.Trigger
      value={value}
      className="-mb-px flex min-h-8 flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent px-2 py-1 font-medium text-fg-muted transition-[color,border-color] duration-(--duration-press) hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg"
    >
      {children}
    </Primitive.Trigger>
  );
}
