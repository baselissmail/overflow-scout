import { elementLabel } from '@/core';

import type { Overlay } from './overlay';

/**
 * DevTools-style element picker. A transparent layer in the overlay takes
 * the pointer, so page handlers never see the picking clicks; the element
 * underneath is found with `elementsFromPoint`.
 */
export class Picker {
  private active = false;
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.stop();
    this.onCancel();
  };

  constructor(
    private readonly doc: Document,
    private readonly overlay: Overlay,
    private readonly onPick: (element: Element) => void,
    private readonly onCancel: () => void,
  ) {}

  get isActive(): boolean {
    return this.active;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.overlay.capturePointer({
      move: (x, y) => {
        const element = this.elementAt(x, y);
        this.overlay.hover(element ? { element, label: describeSize(element) } : null);
      },
      pick: (x, y) => {
        const element = this.elementAt(x, y);
        if (!element) return;
        this.stop();
        this.onPick(element);
      },
    });
    this.doc.addEventListener('keydown', this.onKeyDown, true);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.overlay.releasePointer();
    this.overlay.hover(null);
    this.doc.removeEventListener('keydown', this.onKeyDown, true);
  }

  private elementAt(x: number, y: number): Element | null {
    return this.doc.elementsFromPoint(x, y).find((element) => !this.overlay.owns(element)) ?? null;
  }
}

function describeSize(element: Element): string {
  const rect = element.getBoundingClientRect();
  return `${elementLabel(element)} · ${String(Math.round(rect.width))} × ${String(Math.round(rect.height))}`;
}
