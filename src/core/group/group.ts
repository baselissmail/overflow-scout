import { flatParent } from '../dom';
import type { Finding, FindingKind, Severity } from '../types';
import { SEVERITY_RANK } from '../types';
import { elementSignature } from './fingerprint';

/** One problem in one component, with every place it occurs. */
export interface Issue {
  /** Stable key: kind + element signature + parent signature. */
  id: string;
  kind: FindingKind;
  severity: Severity;
  /** Every occurrence, in document order (never empty). */
  instances: [Finding, ...Finding[]];
}

function signatureOf(element: Element): string {
  return elementSignature({
    tag: element.localName,
    role: element.getAttribute('role'),
    classNames: Array.from(element.classList),
  });
}

export function fingerprint(finding: Finding): string {
  const parent = flatParent(finding.element);
  return [finding.kind, signatureOf(finding.element), parent ? signatureOf(parent) : ''].join('|');
}

/** DOCUMENT_POSITION_FOLLOWING: the other node comes after the reference node. */
const FOLLOWING = 4;

function documentOrder(a: Element, b: Element): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & FOLLOWING ? -1 : 1;
}

/**
 * Groups findings by component and sorts issues by severity, then by where
 * they first appear on the page.
 */
export function groupFindings(findings: readonly Finding[]): Issue[] {
  const issues = new Map<string, Issue>();
  for (const finding of findings) {
    const id = fingerprint(finding);
    const issue = issues.get(id);
    if (issue) {
      issue.instances.push(finding);
    } else {
      issues.set(id, { id, kind: finding.kind, severity: finding.severity, instances: [finding] });
    }
  }

  const sorted = [...issues.values()];
  for (const issue of sorted) {
    issue.instances.sort((a, b) => documentOrder(a.element, b.element));
  }
  return sorted.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      documentOrder(a.instances[0].element, b.instances[0].element),
  );
}
