import { afterEach, describe, expect, it } from 'vitest';

/**
 * Guards the premise of the engine test suite: these tests run with a real
 * layout engine, so overflow can be measured on live elements. The Phase 1
 * fixture corpus builds on this.
 */
describe('browser test environment', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('measures real overflow for a constrained element', () => {
    const box = document.createElement('div');
    box.style.cssText = 'width:100px;white-space:nowrap;overflow:hidden;font:16px sans-serif';
    box.textContent = 'Accept and Continue with Full Details Including All Features';
    document.body.append(box);

    expect(box.clientWidth).toBe(100);
    expect(box.scrollWidth).toBeGreaterThan(box.clientWidth);
  });

  it('reports no overflow for text that wraps freely', () => {
    const paragraph = document.createElement('p');
    paragraph.style.cssText = 'width:300px;font:16px sans-serif';
    paragraph.textContent = 'Short intro paragraph that is allowed to wrap onto more lines.';
    document.body.append(paragraph);

    expect(paragraph.scrollWidth).toBe(paragraph.clientWidth);
    expect(paragraph.scrollHeight).toBe(paragraph.clientHeight);
  });
});
