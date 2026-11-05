/**
 * The thin bar shown while scanning. Scans stream without knowing the total in
 * advance, so it is indeterminate; the live count next to it carries the progress.
 */
export function ProgressBar({ label, valueText }: { label: string; valueText: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuetext={valueText}
      className="relative h-0.5 w-full overflow-hidden rounded-full bg-line"
    >
      <div className="absolute inset-y-0 w-2/5 animate-scan rounded-full bg-accent" />
    </div>
  );
}
