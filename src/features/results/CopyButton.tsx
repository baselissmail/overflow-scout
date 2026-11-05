import { i18n } from '#i18n';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { IconButton } from '@/ui/IconButton';

const ICON = { size: 16, strokeWidth: 1.5 } as const;

function useCopied(): [boolean, () => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 1200);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);
  return [
    copied,
    () => {
      setCopied(true);
    },
  ];
}

/** A copy button that confirms inline for 1.2 s (no toast for a local action). */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, markCopied] = useCopied();
  return (
    <IconButton
      label={copied ? i18n.t('actions.copied') : label}
      icon={copied ? <Check {...ICON} className="text-ok" /> : <Copy {...ICON} />}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(markCopied);
      }}
    />
  );
}
