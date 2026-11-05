import { describe, expect, it } from 'vitest';

import type { FindingDto } from '@/messaging/protocol';

import { adviseFor } from './advice';

function finding(
  mechanism: FindingDto['mechanism'],
  causes: [property: string, value: string, element?: string][],
): FindingDto {
  return {
    id: 'f1',
    kind: 'hidden',
    severity: 'critical',
    mechanism,
    axes: ['x'],
    overflow: { x: 20, y: 0 },
    text: 'Save changes',
    element: { label: 'button.save' },
    container: { label: 'button.save' },
    diagnosis: {
      confidence: 'high',
      causes: causes.map(([property, value, element = 'button.save']) => ({
        element: { label: element },
        property,
        value,
        note: '',
      })),
    },
    box: { width: 100, height: 20 },
  };
}

describe('adviseFor', () => {
  it('puts the direct fix first and hiding overflow last', () => {
    const advice = adviseFor(
      finding('clip', [
        ['overflow-x', 'hidden'],
        ['width', '100px'],
        ['white-space', 'nowrap', 'nav.tabs'],
      ]),
    );
    expect(advice.map((item) => item.key)).toEqual(['whiteSpace', 'width', 'overflow']);
    expect(advice[0]).toEqual({
      key: 'whiteSpace',
      css: 'white-space: normal;',
      element: 'nav.tabs',
    });
  });

  it('turns a fixed height into a minimum height of the same size', () => {
    const [advice] = adviseFor(finding('clip', [['height', '44px']]));
    expect(advice?.css).toBe('height: auto;\nmin-height: 44px;');
  });

  it('reads width differently for fields and for page overflow', () => {
    expect(adviseFor(finding('placeholder', [['width', '120px']]))[0]?.key).toBe('field');
    expect(adviseFor(finding('page-overflow', [['width', '1040px']]))[0]).toMatchObject({
      key: 'pageWidth',
      css: 'max-width: 100%;',
    });
  });

  it('gives one item per kind of fix and ignores unknown causes', () => {
    const advice = adviseFor(
      finding('clip', [
        ['overflow-x', 'hidden'],
        ['overflow-y', 'hidden'],
        ['letter-spacing', '2px'],
      ]),
    );
    expect(advice.map((item) => item.key)).toEqual(['overflow']);
  });
});
