/**
 * Keyboard shortcuts for Overflow Scout
 */

export function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ctrl+Shift+O or Cmd+Shift+O - Trigger scan
    // Check both uppercase and lowercase to handle different keyboard layouts
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
      e.preventDefault();
      console.log('[Overflow Scout] Keyboard shortcut triggered: Scan');
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
