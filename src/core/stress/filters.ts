/** What stress text never touches. Shared by stress sessions and breaking-point search. */

/** Text inside these is code or data, which translators leave alone. */
const UNTRANSLATED_TAGS = new Set(['code', 'kbd', 'samp', 'var']);

/**
 * Subtrees a translator wouldn't touch or that must never be edited:
 * editable regions (editors would save stress text into the user's document),
 * `translate="no"` and `.notranslate` content, and code.
 */
export function isUntouchable(element: Element): boolean {
  const editable = element.getAttribute('contenteditable');
  return (
    (editable !== null && editable !== 'false') ||
    element.getAttribute('translate') === 'no' ||
    element.classList.contains('notranslate') ||
    UNTRANSLATED_TAGS.has(element.localName)
  );
}

/** Ligature icon fonts (Material Icons/Symbols) draw words like "search" as icons. */
export function isIconFont(style: CSSStyleDeclaration): boolean {
  const first = style.fontFamily.split(',')[0] ?? '';
  return /icon|symbol/i.test(first);
}
