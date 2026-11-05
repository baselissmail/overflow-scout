import type { ReactNode } from 'react';

/** A private-use character that no translation contains. */
const SLOT = '';

/**
 * Places an element (a <kbd>, a link) inside a translated sentence, where the
 * translation puts its `$1`, so translators control the word order.
 */
export function interpolate(message: (slot: string) => string, node: ReactNode): ReactNode {
  const [before = '', after = ''] = message(SLOT).split(SLOT);
  return (
    <>
      {before}
      {node}
      {after}
    </>
  );
}
