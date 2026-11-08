import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The top of every view one step in from the main screen: a back link that
 * says where it goes, in the same place each time, and room for controls.
 */
export function StepHeader({
  backLabel,
  onBack,
  children,
}: {
  backLabel: string;
  onBack: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={onBack}
        aria-keyshortcuts="Escape"
        className="-ms-2 inline-flex min-h-8 items-center gap-1.5 rounded-control px-2 font-medium text-fg-muted transition-[background-color,color] duration-(--duration-press) ease-(--ease-out) hover:bg-surface hover:text-fg"
      >
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" className="rtl:rotate-180" />
        {backLabel}
      </button>
      {children}
    </div>
  );
}
