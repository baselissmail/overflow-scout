import { Switch as Primitive } from 'radix-ui';
import { useId } from 'react';

export interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** An on/off setting; the whole row is the hit target. */
export function Switch({ label, description, checked, onChange }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <label htmlFor={id} className="flex min-w-0 flex-col">
        <span>{label}</span>
        {description && <span className="text-small text-fg-muted">{description}</span>}
      </label>
      <Primitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-line-strong bg-surface transition-[background-color,border-color] duration-(--duration-press) data-[state=checked]:border-accent data-[state=checked]:bg-accent"
      >
        <Primitive.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-fg-muted transition-transform duration-(--duration-press) ease-(--ease-out) data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-fg rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[18px]" />
      </Primitive.Root>
    </div>
  );
}
