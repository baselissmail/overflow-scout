import { Slider as Primitive } from 'radix-ui';

export interface SliderProps {
  /** Names the thumb for assistive technology. */
  label: string;
  /** Read out instead of the bare number, e.g. "24 characters". */
  valueText: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/** One value on a range: arrow keys step by 1, Page Up/Down by 10%, Home/End jump. */
export function Slider({ label, valueText, value, min, max, onChange }: SliderProps) {
  return (
    <Primitive.Root
      value={[value]}
      min={min}
      max={max}
      step={1}
      onValueChange={([next]) => {
        if (next !== undefined) onChange(next);
      }}
      className="relative flex h-6 w-full touch-none items-center select-none"
    >
      <Primitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface">
        <Primitive.Range className="absolute h-full bg-accent" />
      </Primitive.Track>
      <Primitive.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="block size-4 rounded-full border-2 border-accent bg-raised transition-[box-shadow] duration-(--duration-press) ease-(--ease-out) hover:shadow-[0_0_0_4px_var(--color-accent-soft)]"
      />
    </Primitive.Root>
  );
}
