import { cx } from './cx';

export interface SeveritySegment {
  key: string;
  count: number;
  /** Background class for the segment (bg-critical, ...). */
  colorClass: string;
}

/**
 * How the problems divide by severity, as one proportional bar. It sits with
 * the filters rather than as a headline number; the chips carry the counts.
 */
export function SeverityBar({
  segments,
  label,
}: {
  segments: readonly SeveritySegment[];
  label: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  if (total === 0) return null;
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full"
    >
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => (
          <span
            key={segment.key}
            className={cx(
              'h-full origin-left animate-grow rounded-full rtl:origin-right',
              segment.colorClass,
            )}
            style={{ flexGrow: segment.count }}
          />
        ))}
    </div>
  );
}
