import type { AtRiskFinding, Finding, Issue } from '@/core';
import { elementLabel, elementSelector, groupFindings } from '@/core';
import type { ElementRef, FindingDto, IssueDto } from '@/messaging/protocol';

/**
 * Keeps the live findings on the page side and hands the panel plain data
 * with ids, so highlight and reveal requests can find the element again.
 */
export class FindingRegistry {
  private readonly findings = new Map<string, Finding>();
  private next = 0;

  add(finding: Finding): string {
    this.next += 1;
    const id = `f${String(this.next)}`;
    this.findings.set(id, finding);
    return id;
  }

  get(id: string): Finding | undefined {
    return this.findings.get(id);
  }

  clear(): void {
    this.findings.clear();
  }
}

function ref(element: Element, withSelector: boolean): ElementRef {
  const label = elementLabel(element);
  return withSelector ? { label, selector: elementSelector(element) } : { label };
}

/** DOCUMENT_POSITION_FOLLOWING: the other node comes after the reference node. */
const FOLLOWING = 4;

/** Looks up the text an element showed before stress, for at-risk findings. */
export type BeforeText = (element: Element) => string | null;

function toFindingDto(
  finding: Finding | AtRiskFinding,
  registry: FindingRegistry,
  withSelector: boolean,
  before: BeforeText | undefined,
): FindingDto {
  const rect = finding.container.getBoundingClientRect();
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    id: registry.add(finding),
    kind: finding.kind,
    severity: finding.severity,
    mechanism: finding.mechanism,
    axes: finding.axes,
    overflow: finding.overflow,
    text: finding.text,
    element: ref(finding.element, withSelector),
    container: ref(finding.container, withSelector),
    diagnosis: {
      confidence: finding.diagnosis.confidence,
      causes: finding.diagnosis.causes.map((cause) => ({
        element: ref(cause.element, false),
        property: cause.property,
        value: cause.value,
        note: cause.note,
      })),
    },
    box: { width: round(rect.width), height: round(rect.height) },
    ...('growth' in finding && { growth: finding.growth }),
    ...(before && { before: before(finding.element) }),
  };
}

/**
 * Groups findings into issues. Unique selectors are slow to compute, so only
 * the first instance of each issue gets one.
 */
export function toIssueDtos(
  findings: readonly Finding[],
  registry: FindingRegistry,
  before?: BeforeText,
): IssueDto[] {
  const issues = groupFindings(findings);
  // groupFindings sorts by severity, then page order; recover page order for sorting.
  const byPosition = [...issues].sort((a, b) =>
    a.instances[0].element.compareDocumentPosition(b.instances[0].element) & FOLLOWING ? -1 : 1,
  );
  const order = new Map(byPosition.map((issue, index) => [issue, index]));
  return issues.map((issue: Issue) => {
    const [first, ...rest] = issue.instances;
    return {
      id: issue.id,
      order: order.get(issue) ?? 0,
      kind: issue.kind,
      severity: issue.severity,
      instances: [
        toFindingDto(first, registry, true, before),
        ...rest.map((finding) => toFindingDto(finding, registry, false, before)),
      ],
    };
  });
}
