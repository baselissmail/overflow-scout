import { i18n } from '#i18n';

import { useOpenShortcut } from '@/features/page/use-open-shortcut';
import { Dialog } from '@/ui/Dialog';
import { Kbd } from '@/ui/Kbd';

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const shortcut = useOpenShortcut();
  const rows: [string[], string][] = [
    [['j', '↓'], i18n.t('shortcuts.next')],
    [['k', '↑'], i18n.t('shortcuts.previous')],
    [['Enter'], i18n.t('shortcuts.open')],
    [['Esc'], i18n.t('shortcuts.close')],
    [['/'], i18n.t('shortcuts.search')],
    [['?'], i18n.t('shortcuts.help')],
    ...(shortcut ? ([[[shortcut], i18n.t('shortcuts.panel')]] as [string[], string][]) : []),
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={i18n.t('shortcuts.heading')}
      closeLabel={i18n.t('actions.close')}
    >
      <dl className="flex flex-col gap-2">
        {rows.map(([keys, action]) => (
          <div key={action} className="flex items-center justify-between gap-3">
            <dt>{action}</dt>
            <dd className="flex shrink-0 gap-1">
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
