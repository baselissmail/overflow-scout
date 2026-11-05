import { windowOf } from '@/core/dom';

/**
 * Everything Overflow Scout draws on a page lives in one shadow root under
 * one host element (plan §2.5): highlights, the picker's hover box, and the
 * "Stress test active · Revert" pill. Page elements are never styled or
 * given attributes.
 *
 * Styles use a constructed stylesheet (`adoptedStyleSheets`), which a strict
 * page CSP can't block the way it blocks `<style>` elements (plan §13, S3).
 */

export const OVERLAY_TAG = 'overflow-scout-root';

const STYLES = `
:host {
  all: initial !important;
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483647 !important;
  pointer-events: none !important;
  contain: strict !important;
}
.box {
  position: fixed;
  box-sizing: border-box;
  border-radius: 2px;
  pointer-events: none;
}
.box[data-role='target'] { outline: 2px solid #e5484d; background: rgb(229 72 77 / 0.14); }
.box[data-role='container'] { outline: 2px dashed #0d74ce; outline-offset: -1px; }
.box[data-role='hover'] { outline: 2px solid #0d74ce; background: rgb(13 116 206 / 0.12); }
.tag {
  position: fixed;
  max-width: min(480px, calc(100vw - 16px));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 600 11px/18px ui-sans-serif, system-ui, sans-serif;
  color: #fff;
  background: #1c2024;
  padding: 0 6px;
  border-radius: 4px;
  pointer-events: none;
}
.catcher { position: fixed; inset: 0; pointer-events: auto; cursor: crosshair; }
.pill {
  position: fixed;
  inset-inline-end: 16px;
  inset-block-end: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 6px 6px 14px;
  border-radius: 999px;
  font: 500 13px/20px ui-sans-serif, system-ui, sans-serif;
  color: #fff;
  background: #1c2024;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.24);
  pointer-events: auto;
}
.pill button {
  all: unset;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 999px;
  font-weight: 600;
  color: #1c2024;
  background: #fff;
}
.pill button:hover { background: #e8e8ec; }
.pill button:focus-visible { outline: 2px solid #70b8ff; outline-offset: 2px; }
@media (prefers-reduced-motion: no-preference) {
  .box[data-flash] { animation: flash 700ms ease-out 2; }
}
@keyframes flash { 50% { background: rgb(229 72 77 / 0.4); } }
`;

export interface HighlightTarget {
  element: Element;
  /** The box that clips or is overflowed, outlined when it differs from the element. */
  container?: Element | null;
  label: string;
}

export interface OverlayText {
  stressActive: string;
  revert: string;
}

type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export class Overlay {
  readonly host: HTMLElement;
  private readonly root: ShadowRoot;
  private readonly view: Window & typeof globalThis;
  private target: HighlightTarget | null = null;
  private hovered: HighlightTarget | null = null;
  private pill: HTMLElement | null = null;
  private catcher: HTMLElement | null = null;
  private frame = 0;
  private readonly onViewportChange = () => {
    this.schedule();
  };

  constructor(
    private readonly doc: Document,
    private readonly text: OverlayText,
  ) {
    this.view = windowOf(doc) as Window & typeof globalThis;
    this.host = doc.createElement(OVERLAY_TAG);
    // Open, so tests can inspect it; it holds nothing the page doesn't already show.
    this.root = this.host.attachShadow({ mode: 'open' });
    const sheet = new this.view.CSSStyleSheet();
    sheet.replaceSync(STYLES);
    this.root.adoptedStyleSheets = [sheet];
  }

  /** True for the overlay's own host, which scans and stress must leave out. */
  owns(element: Element): boolean {
    return element === this.host;
  }

  highlight(target: HighlightTarget | null, flash = false): void {
    this.target = target;
    this.render(flash);
  }

  hover(target: HighlightTarget | null): void {
    this.hovered = target;
    this.render(false);
  }

  /** Covers the page with a transparent layer that receives pointer events (picker). */
  capturePointer(handlers: {
    move: (x: number, y: number) => void;
    pick: (x: number, y: number) => void;
  }): void {
    this.releasePointer();
    const catcher = this.doc.createElement('div');
    catcher.className = 'catcher';
    catcher.addEventListener('pointermove', (event) => {
      handlers.move(event.clientX, event.clientY);
    });
    catcher.addEventListener('click', (event) => {
      event.preventDefault();
      handlers.pick(event.clientX, event.clientY);
    });
    this.catcher = catcher;
    this.mount().append(catcher);
  }

  releasePointer(): void {
    this.catcher?.remove();
    this.catcher = null;
  }

  showStressPill(onRevert: () => void): void {
    if (this.pill) return;
    const pill = this.doc.createElement('div');
    pill.className = 'pill';
    pill.setAttribute('role', 'status');
    const label = this.doc.createElement('span');
    label.textContent = this.text.stressActive;
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.textContent = this.text.revert;
    button.addEventListener('click', onRevert);
    pill.append(label, button);
    this.pill = pill;
    this.mount().append(pill);
  }

  hideStressPill(): void {
    this.pill?.remove();
    this.pill = null;
  }

  destroy(): void {
    this.view.cancelAnimationFrame(this.frame);
    this.view.removeEventListener('scroll', this.onViewportChange, true);
    this.view.removeEventListener('resize', this.onViewportChange);
    this.target = null;
    this.hovered = null;
    this.pill = null;
    this.catcher = null;
    this.root.replaceChildren();
    this.host.remove();
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  private mount(): ShadowRoot {
    if (!this.host.isConnected) {
      // On <html>, not <body>: apps often replace the body's children.
      this.doc.documentElement.append(this.host);
      this.view.addEventListener('scroll', this.onViewportChange, { capture: true, passive: true });
      this.view.addEventListener('resize', this.onViewportChange, { passive: true });
    }
    return this.root;
  }

  private schedule(): void {
    if (this.frame) return;
    this.frame = this.view.requestAnimationFrame(() => {
      this.frame = 0;
      this.render(false);
    });
  }

  private render(flash: boolean): void {
    for (const node of this.root.querySelectorAll('.box, .tag')) node.remove();
    const layers: [HighlightTarget | null, 'target' | 'hover'][] = [
      [this.target, 'target'],
      [this.hovered, 'hover'],
    ];
    for (const [target, role] of layers) {
      if (!target?.element.isConnected) continue;
      const rect = target.element.getBoundingClientRect();
      const { container } = target;
      if (role === 'target' && container && container !== target.element) {
        this.box(container.getBoundingClientRect(), 'container', false);
      }
      this.box(rect, role, flash && role === 'target');
      this.tag(rect, target.label);
    }
  }

  private box(rect: Rect, role: string, flash: boolean): void {
    const box = this.doc.createElement('div');
    box.className = 'box';
    box.dataset['role'] = role;
    if (flash) box.dataset['flash'] = '';
    Object.assign(box.style, {
      left: `${String(rect.left)}px`,
      top: `${String(rect.top)}px`,
      width: `${String(Math.max(rect.width, 2))}px`,
      height: `${String(Math.max(rect.height, 2))}px`,
    });
    this.mount().append(box);
  }

  private tag(rect: Rect, label: string): void {
    const tag = this.doc.createElement('div');
    tag.className = 'tag';
    tag.textContent = label;
    // Above the box, or inside its top edge when there's no room above.
    const top = rect.top >= 22 ? rect.top - 20 : rect.top + 2;
    Object.assign(tag.style, {
      left: `${String(Math.max(4, rect.left))}px`,
      top: `${String(Math.max(2, top))}px`,
    });
    this.mount().append(tag);
  }
}
