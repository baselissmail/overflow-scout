import { cx } from './cx';

export interface CutTextProps {
  visible: string;
  hidden: string;
  /** Labels for screen readers, e.g. "Visible" and "Cut off". */
  visibleLabel: string;
  hiddenLabel: string;
  /** Severity color class for the crop mark and the bleed (text-critical, ...). */
  toneClass: string;
  className?: string;
  /** Full text on hover, for previews clamped to a few lines. */
  title?: string;
}

/**
 * The signature: the text as readers see it, a crop mark where it is cut, and
 * the lost part over a faint bleed. Reading order is kept, so right-to-left
 * text lays itself out correctly.
 */
export function CutText({
  visible,
  hidden,
  visibleLabel,
  hiddenLabel,
  toneClass,
  className,
  title,
}: CutTextProps) {
  return (
    <span className={cx('break-words', className)} title={title}>
      <span className="sr-only">{visibleLabel}: </span>
      <span>{visible}</span>
      <span
        aria-hidden="true"
        className={cx(
          'relative mx-px inline-block h-[1.15em] w-0 border-s-[1.5px] border-current align-[-0.2em]',
          toneClass,
        )}
      >
        <span className="absolute -start-[3.5px] -top-px h-px w-2 bg-current" />
        <span className="absolute -start-[3.5px] -bottom-px h-px w-2 bg-current" />
      </span>
      <span className="sr-only">{hiddenLabel}: </span>
      <span className={cx('bg-bleed rounded-[2px] text-fg-muted', toneClass)}>
        <span className="text-fg-muted">{hidden}</span>
      </span>
    </span>
  );
}
