/**
 * Serializes a document for exact before/after comparison: every node in the
 * flat tree, attributes in their original order, open shadow roots, and live
 * input values (which `outerHTML` doesn't show).
 */
export function snapshotDom(doc: Document): string {
  const lines: string[] = [];
  const visit = (node: Node, depth: number) => {
    const indent = '  '.repeat(depth);
    switch (node.nodeType) {
      case Node.ELEMENT_NODE: {
        const element = node as Element;
        const attributes = Array.from(
          element.attributes,
          (attribute) => ` ${attribute.name}=${JSON.stringify(attribute.value)}`,
        );
        const live =
          element.localName === 'input' || element.localName === 'textarea'
            ? ` .value=${JSON.stringify((element as HTMLInputElement).value)}`
            : '';
        lines.push(`${indent}<${element.localName}${attributes.join('')}${live}>`);
        if (element.shadowRoot) {
          lines.push(`${indent}  #shadow-root`);
          for (const child of element.shadowRoot.childNodes) visit(child, depth + 2);
        }
        if (element.localName === 'template') {
          for (const child of (element as HTMLTemplateElement).content.childNodes)
            visit(child, depth + 1);
        }
        break;
      }
      case Node.TEXT_NODE:
        lines.push(`${indent}${JSON.stringify((node as Text).data)}`);
        break;
      case Node.COMMENT_NODE:
        lines.push(`${indent}<!--${(node as Comment).data}-->`);
        break;
      default:
        break;
    }
    for (const child of node.childNodes) visit(child, depth + 1);
  };
  visit(doc.documentElement, 0);
  return lines.join('\n');
}
