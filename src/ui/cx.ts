/** Joins class names, skipping falsy ones. Variants are designed not to conflict. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
