import { Tabs as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';

export const Tabs = Primitive.Root;
export const TabsContent = Primitive.Content;

export function TabsList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Primitive.List aria-label={label} className="flex gap-0.5 rounded-control bg-surface p-0.5">
      {children}
    </Primitive.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Primitive.Trigger
      value={value}
      className="flex min-h-7 flex-auto items-center justify-center gap-1.5 rounded-[5px] px-2 py-0.5 font-medium text-fg-muted transition-[background-color,color,box-shadow] duration-(--duration-press) hover:text-fg data-[state=active]:bg-raised data-[state=active]:text-fg data-[state=active]:shadow-raised"
    >
      {children}
    </Primitive.Trigger>
  );
}
