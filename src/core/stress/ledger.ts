/**
 * The stress ledger: the only way stress text reaches the page. It records the
 * original value of everything it changes, so a revert restores the page
 * byte for byte (plan §2.5, §4.2).
 *
 * Only these are ever written: `Text.data`, and the `placeholder`, `value`
 * (button inputs) and `dir` (root element) attributes. Nodes are never added,
 * removed or replaced, so frameworks keep valid references to every node.
 *
 * If the page itself changes a value after we wrote it (an app re-render), the
 * page's value wins: revert leaves it alone, and the next write treats it as
 * the new original. Reverting over it would put stale text back on screen.
 */

export type StressedAttribute = 'placeholder' | 'value' | 'dir';

interface TextEntry {
  node: Text;
  original: string;
  written: string;
}

interface AttributeEntry {
  element: Element;
  name: StressedAttribute;
  /** `null` when the attribute was absent. */
  original: string | null;
  written: string;
}

export interface RevertResult {
  /** Values put back to their originals. */
  restored: number;
  /** Values the page changed after stress was applied; the page's value was kept. */
  keptPageChanges: number;
}

export class StressLedger {
  private readonly texts = new Map<Text, TextEntry>();
  private readonly attributes = new Map<Element, Map<StressedAttribute, AttributeEntry>>();

  get size(): number {
    let count = this.texts.size;
    for (const byName of this.attributes.values()) count += byName.size;
    return count;
  }

  /** The value the page wants for this text node: its original, or the page's own update. */
  originalText(node: Text): string {
    const entry = this.texts.get(node);
    return entry?.written === node.data ? entry.original : node.data;
  }

  originalAttribute(element: Element, name: StressedAttribute): string | null {
    const entry = this.attributes.get(element)?.get(name);
    const current = element.getAttribute(name);
    return entry?.written === current ? entry.original : current;
  }

  /** True when the node shows text we wrote and the page hasn't changed since. */
  ownsText(node: Text): boolean {
    const entry = this.texts.get(node);
    return entry?.written === node.data;
  }

  ownsAttribute(element: Element, name: StressedAttribute): boolean {
    const entry = this.attributes.get(element)?.get(name);
    return entry?.written === element.getAttribute(name);
  }

  writeText(node: Text, value: string): void {
    const original = this.originalText(node);
    this.texts.set(node, { node, original, written: value });
    if (node.data !== value) node.data = value;
  }

  writeAttribute(element: Element, name: StressedAttribute, value: string): void {
    const original = this.originalAttribute(element, name);
    let byName = this.attributes.get(element);
    if (!byName) {
      byName = new Map();
      this.attributes.set(element, byName);
    }
    byName.set(name, { element, name, original, written: value });
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }

  /** What we wrote to a text node, and what it held before. */
  textEntry(node: Text): { original: string; written: string } | undefined {
    return this.texts.get(node);
  }

  /** Stressed `placeholder` and `value` attributes of an element. */
  attributeEntries(element: Element): { original: string | null; written: string }[] {
    const byName = this.attributes.get(element);
    return byName ? [...byName.values()].filter((entry) => entry.name !== 'dir') : [];
  }

  /** Values the page changed after we wrote them (on connected nodes). */
  changedByPage(): number {
    let count = 0;
    for (const entry of this.texts.values()) {
      if (entry.node.isConnected && entry.node.data !== entry.written) count += 1;
    }
    for (const byName of this.attributes.values()) {
      for (const entry of byName.values()) {
        if (entry.element.isConnected && entry.element.getAttribute(entry.name) !== entry.written) {
          count += 1;
        }
      }
    }
    return count;
  }

  /**
   * Restores every value we still own, including on nodes the page removed
   * (a framework may re-attach them later). Clears the ledger.
   */
  revert(): RevertResult {
    const result: RevertResult = { restored: 0, keptPageChanges: 0 };
    for (const entry of this.texts.values()) {
      if (entry.node.data === entry.written) {
        entry.node.data = entry.original;
        result.restored += 1;
      } else {
        result.keptPageChanges += 1;
      }
    }
    for (const byName of this.attributes.values()) {
      for (const entry of byName.values()) {
        const { element, name, original, written } = entry;
        if (element.getAttribute(name) !== written) {
          result.keptPageChanges += 1;
          continue;
        }
        if (original === null) element.removeAttribute(name);
        else element.setAttribute(name, original);
        result.restored += 1;
      }
    }
    this.texts.clear();
    this.attributes.clear();
    return result;
  }
}
