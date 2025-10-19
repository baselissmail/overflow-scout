/**
 * Keyboard shortcuts for Overflow Scout
 */

export function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ctrl+Shift+O or Cmd+Shift+O - Trigger scan
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'O') {
      e.preventDefault();
      window.postMessage({ type: 'OVERFLOW_SCOUT_RESCAN' }, '*');
    }
    
    // Esc - Close panel
    if (e.key === 'Escape') {
      const panel = document.getElementById('overflow-scout-results-panel');
      if (panel && panel.getAttribute('data-panel-open') === 'true') {
        e.preventDefault();
        // Collapse to tab
        const closeBtn = panel.querySelector('#close-panel') as HTMLElement;
        closeBtn?.click();
      }
    }
  });
}
