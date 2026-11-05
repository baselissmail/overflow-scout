import { i18n } from '#i18n';
import { Crosshair, ScanText, WholeWord } from 'lucide-react';
import type { ReactNode } from 'react';

import { useOpenShortcut } from '@/features/page/use-open-shortcut';
import { Kbd } from '@/ui/Kbd';
import { interpolate } from '@/ui/interpolate';

interface HomeProps {
  disabled: boolean;
  onScan: () => void;
  onStress: () => void;
  onInspect: () => void;
  onDemo: () => void;
}

const ICON = { size: 18, strokeWidth: 1.5 } as const;

function Action({
  icon,
  title,
  body,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-start gap-3 rounded-card border border-line p-3 text-start transition-[background-color,border-color] duration-(--duration-press) hover:border-line-strong hover:bg-surface disabled:opacity-50"
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-accent">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        <span className="text-fg-muted">{body}</span>
      </span>
    </button>
  );
}

/** First run and no results yet: three things to do, no tour (plan §5.3). */
export function Home({ disabled, onScan, onStress, onInspect, onDemo }: HomeProps) {
  const shortcut = useOpenShortcut();
  return (
    <section className="flex flex-col gap-2" aria-label={i18n.t('extName')}>
      <Action
        icon={<ScanText {...ICON} />}
        title={i18n.t('actions.scan')}
        body={i18n.t('home.scan')}
        disabled={disabled}
        onClick={onScan}
      />
      <Action
        icon={<WholeWord {...ICON} />}
        title={i18n.t('actions.stress')}
        body={i18n.t('home.stress')}
        disabled={disabled}
        onClick={onStress}
      />
      <Action
        icon={<Crosshair {...ICON} />}
        title={i18n.t('actions.inspect')}
        body={i18n.t('home.inspect')}
        disabled={disabled}
        onClick={onInspect}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          className="text-accent underline underline-offset-2 hover:no-underline"
          onClick={onDemo}
        >
          {i18n.t('actions.demo')}
        </button>
        {shortcut && (
          <span className="text-small text-fg-muted">
            {interpolate((slot) => i18n.t('home.shortcut', [slot]), <Kbd>{shortcut}</Kbd>)}
          </span>
        )}
      </div>
    </section>
  );
}
