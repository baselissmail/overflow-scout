import { describeElement } from '@/core';
import type { Finding } from '@/core';

/** Viewport for a fixture: `<meta name="fixture-viewport" content="375x667">`, else 1024×768. */
function viewportOf(html: string): { width: number; height: number } {
  const match = /<meta name="fixture-viewport" content="(\d+)x(\d+)"/.exec(html);
  return match
    ? { width: Number(match[1]), height: Number(match[2]) }
    : { width: 1024, height: 768 };
}

/** Loads fixture HTML into an iframe with its own viewport and waits for fonts. */
export async function loadFixture(html: string): Promise<{ doc: Document; dispose: () => void }> {
  const { width, height } = viewportOf(html);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:absolute;left:0;top:0;border:0;width:${String(width)}px;height:${String(height)}px`;
  const loaded = new Promise<void>((resolve) => {
    iframe.addEventListener(
      'load',
      () => {
        resolve();
      },
      { once: true },
    );
  });
  iframe.srcdoc = html;
  document.body.append(iframe);
  await loaded;

  const doc = iframe.contentDocument;
  if (!doc) throw new Error('Fixture iframe has no document');
  await doc.fonts.ready;
  return {
    doc,
    dispose: () => {
      iframe.remove();
    },
  };
}

/** Every annotated element, including those inside open shadow roots. */
function annotatedElements(root: Document | ShadowRoot, attribute: string): Element[] {
  const found = Array.from(root.querySelectorAll(`[${attribute}]`));
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot) found.push(...annotatedElements(element.shadowRoot, attribute));
  }
  return found;
}

export interface FixtureScore {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  /** Mismatches that are not documented as known limitations. These fail the test. */
  unexpected: string[];
  /** Mismatches on elements marked `data-limitation`. Counted, but tolerated. */
  limitations: string[];
}

function describe(element: Element): string {
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return `${describeElement(element).label} "${text}"`;
}

/**
 * Scores findings against annotations. `data-expect` lists the kinds expected
 * on an element (space separated) or `ok`; findings on unannotated elements
 * are false positives. Stress tests score at-risk findings against
 * `data-at-risk` the same way.
 */
export function scoreFixture(
  doc: Document,
  findings: readonly Finding[],
  attribute: 'data-expect' | 'data-at-risk' = 'data-expect',
): FixtureScore {
  const score: FixtureScore = {
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
    unexpected: [],
    limitations: [],
  };
  const expected = new Map<Element, Set<string>>();
  for (const element of annotatedElements(doc, attribute)) {
    const kinds = (element.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean);
    expected.set(element, new Set(kinds.filter((kind) => kind !== 'ok')));
  }
  const report = (element: Element, message: string) => {
    const limitation = element.getAttribute('data-limitation');
    if (limitation) score.limitations.push(`${message} (known limitation: ${limitation})`);
    else score.unexpected.push(message);
  };

  const found = new Map<Element, Set<string>>();
  for (const finding of findings) {
    const kinds = found.get(finding.element) ?? new Set<string>();
    kinds.add(finding.kind);
    found.set(finding.element, kinds);
    if (expected.get(finding.element)?.has(finding.kind)) {
      score.truePositives += 1;
    } else {
      score.falsePositives += 1;
      report(finding.element, `unexpected ${finding.kind} on ${describe(finding.element)}`);
    }
  }
  for (const [element, kinds] of expected) {
    for (const kind of kinds) {
      if (!found.get(element)?.has(kind)) {
        score.falseNegatives += 1;
        report(element, `missed ${kind} on ${describe(element)}`);
      }
    }
  }
  return score;
}
