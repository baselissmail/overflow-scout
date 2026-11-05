import { i18n } from '#i18n';
import { ClipboardCopy, FileDown, FileJson, Share } from 'lucide-react';

import type { PanelState } from '@/features/page/controller';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Popover } from '@/ui/Popover';
import { useToast } from '@/ui/Toast';

import { downloadText, exportResults } from './export';

const ICON = { size: 16, strokeWidth: 1.5 } as const;

/** Copy or save every result: Markdown for bug trackers, JSON for scripts. */
export function ExportMenu({
  state,
  ignored,
}: {
  state: PanelState;
  /** Issues ignored on this site, left out of the export. */
  ignored: ReadonlySet<string>;
}) {
  const toast = useToast();
  return (
    <Popover
      label={i18n.t('report.export')}
      trigger={<IconButton label={i18n.t('report.export')} icon={<Share {...ICON} />} />}
    >
      <p className="mb-2 font-medium">{i18n.t('report.export')}</p>
      <div className="flex flex-col items-stretch gap-1.5">
        <Button
          variant="primary"
          icon={<ClipboardCopy {...ICON} />}
          onClick={() => {
            const exported = exportResults(state, ignored);
            if (!exported) return;
            void navigator.clipboard.writeText(exported.markdown).then(() => {
              toast(i18n.t('report.copied'));
            });
          }}
        >
          {i18n.t('report.copyMarkdown')}
        </Button>
        <Button
          icon={<FileDown {...ICON} />}
          onClick={() => {
            const exported = exportResults(state, ignored);
            if (exported) downloadText(exported.markdownName, exported.markdown, 'text/markdown');
          }}
        >
          {i18n.t('report.saveMarkdown')}
        </Button>
        <Button
          icon={<FileJson {...ICON} />}
          onClick={() => {
            const exported = exportResults(state, ignored);
            if (exported) downloadText(exported.jsonName, exported.json, 'application/json');
          }}
        >
          {i18n.t('report.saveJson')}
        </Button>
      </div>
      <p className="mt-2 text-small text-fg-muted">{i18n.t('report.exportNote')}</p>
    </Popover>
  );
}
