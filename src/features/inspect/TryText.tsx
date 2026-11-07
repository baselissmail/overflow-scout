import { i18n } from '#i18n';
import { useEffect, useState } from 'react';

import { TextTrial } from '@/features/try/TextTrial';
import type { TextTrialProps } from '@/features/try/TextTrial';

export interface TryTextProps {
  /** Puts a text in the picked element and measures it; null puts its own text back. */
  onTry: TextTrialProps['onTry'];
  /** The element's whole text; null when the page can't be reached. */
  loadText: () => Promise<string | null>;
  /** Shown text to start from when the whole text can't be read. */
  fallback: string;
}

/**
 * Try other text in the measured element (plan §5.3): your own words, any
 * length, or real-world examples. The page shows it live; it goes back when
 * the card closes.
 */
export function TryText({ onTry, loadText, fallback }: TryTextProps) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    void loadText().then((value) => {
      if (current) setText(value ?? fallback);
    });
    return () => {
      current = false;
    };
  }, [loadText, fallback]);

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="font-medium">{i18n.t('inspect.tryHeading')}</h3>
        <p className="text-small text-fg-muted">{i18n.t('inspect.tryHint')}</p>
      </div>
      {text !== null && <TextTrial initialText={text} onTry={onTry} presets />}
    </section>
  );
}
