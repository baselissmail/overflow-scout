/**
 * Create card for manually added element (from interactive mode)
 */
export function createManualElementCard(element: HTMLElement, elementData: any, index: number): HTMLElement {
  const card = document.createElement('div');
  card.setAttribute('data-element-id', elementData.elementId);
  
  card.style.cssText = `
    background: #eff6ff;
    border: 2px solid #3b82f6;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
    font-size: 13px;
    animation: slideInCard 0.3s ease-out;
  `;
  
  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
      <div style="font-weight: 600; color: #1e40af; flex: 1;">
        #${index + 1} ${elementData.selector}
      </div>
      <div style="
        background: #3b82f6;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
      ">Manual</div>
    </div>
    
    <div style="color: #1e40af; font-size: 12px; margin-bottom: 8px; font-style: italic;">
      "${elementData.originalText}..."
    </div>
    
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #bfdbfe;">
      <div style="font-weight: 600; color: #1e40af; font-size: 11px; margin-bottom: 6px;">
        🧪 Test with Different Text:
      </div>
      <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;">
        <button class="preset-btn-${index}" data-text="María José García-Hernández" style="
          background: white;
          border: 1px solid #93c5fd;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">Long Name</button>
        <button class="preset-btn-${index}" data-text="Apple MacBook Pro 16-inch M3 Max with 64GB" style="
          background: white;
          border: 1px solid #93c5fd;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">Product</button>
        <button class="preset-btn-${index}" data-text="https://www.very-long-domain-name.example.com" style="
          background: white;
          border: 1px solid #93c5fd;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">URL</button>
        <button class="preset-btn-${index}" data-text="user.name@company-subdomain.org" style="
          background: white;
          border: 1px solid #93c5fd;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">Email</button>
      </div>
      <input 
        type="text" 
        id="custom-input-manual-${index}" 
        placeholder="Or type your own..." 
        style="
          width: 100%;
          border: 1px solid #93c5fd;
          border-radius: 4px;
          padding: 6px 8px;
          font-size: 11px;
          margin-bottom: 6px;
        "
      />
      <div style="display: flex; gap: 4px;">
        <button class="test-custom-btn" data-issue-index="${index}" style="
          background: #10b981;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          flex: 1;
        ">Test with New Text</button>
        <button class="revert-btn" data-issue-index="${index}" style="
          background: #6b7280;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          opacity: 0.5;
          pointer-events: none;
        " disabled>Revert</button>
      </div>
    </div>
    
    <button class="jump-btn" data-issue-index="${index}" style="
      margin-top: 8px;
      background: #3b82f6;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    ">Jump to Element</button>
  `;
  
  // Wire up handlers (same as auto-scan cards)
  setupCardHandlers(card, element, index, true);
  
  return card;
}

/**
 * Setup card event handlers
 */
function setupCardHandlers(card: HTMLElement, element: HTMLElement, index: number, isManual: boolean): void {
  const inputId = isManual ? `custom-input-manual-${index}` : `custom-input-${index}`;
  
  // Preset buttons
  card.querySelectorAll(`.preset-btn-${index}`).forEach(btn => {
    btn.addEventListener('click', () => {
      const text = (btn as HTMLElement).dataset.text;
      const input = document.getElementById(inputId) as HTMLInputElement;
      if (input && text) {
        input.value = text;
      }
    });
  });
  
  // Test button
  card.querySelector('.test-custom-btn')?.addEventListener('click', () => {
    const input = document.getElementById(inputId) as HTMLInputElement;
    const customText = input?.value.trim();
    
    if (customText) {
      testElementWithCustomText(element, customText, card);
    }
  });
  
  // Revert button
  card.querySelector('.revert-btn')?.addEventListener('click', () => {
    revertElement(element, card);
  });
  
  // Jump button
  card.querySelector('.jump-btn')?.addEventListener('click', () => {
    jumpToElement(element);
  });
}

// These functions should be imported from autoBadge.ts
// For now, stub them
function testElementWithCustomText(_element: HTMLElement, _text: string, _card: HTMLElement): void {
  // Implementation from autoBadge
}

function revertElement(_element: HTMLElement, _card: HTMLElement): void {
  // Implementation from autoBadge
}

function jumpToElement(_element: HTMLElement): void {
  // Implementation from autoBadge
}
