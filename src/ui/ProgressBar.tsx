/**
 * The thin bar shown while scanning. Scans stream without knowing the total in
 * advance, so it is indeterminate: a band of light passes along the track, and
 * the live count next to it carries the progress. Static under reduced motion.
 */
export function ProgressBar({ label, valueText }: { label: string; valueText: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuetext={valueText}
      className="bg-shimmer h-0.5 w-full animate-scan overflow-hidden rounded-full bg-accent-soft"
    />
  );
}
