import type { ReactNode } from 'react';

/** An empty or finished state says what was checked and offers the next action. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-card border border-dashed border-line p-3">
      <p className="font-medium">{title}</p>
      {body && <p className="text-fg-muted">{body}</p>}
      {action}
    </div>
  );
}
