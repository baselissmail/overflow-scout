/**
 * Auto-Scan Badge - Floating indicator for overflow issues
 * Shows count and allows viewing detailed results
 */

import type { OverflowIssue } from './autoScanner';

const BADGE_ID = 'overflow-scout-auto-badge';
const PANEL_ID = 'overflow-scout-results-panel';

/**
 * Remove existing badge
 */
export function removeBadge(): void {
  const badge = document.getElementById(BADGE_ID);
  if (badge) badge.remove();
}

/**
 * Create floating badge showing issue count
 */
export function createAutoBadge(issueCount: number, onClick: () => void): void {
  removeBadge();
  
  if (issueCount === 0) return; // Don't show if no issues
  
  const badge = document.createElement('div');
  badge.id = BADGE_ID;
  
  // Determine color based on severity
  const bgColor = issueCount > 10 ? '#dc2626' : issueCount > 5 ? '#f59e0b' : '#3b82f6';
  
  badge.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 2147483646;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: all 0.2s;
    animation: slideIn 0.3s ease-out;
  `;
  
  badge.innerHTML = `
    <div style="font-size: 20px; font-weight: 700; line-height: 1;">${issueCount}</div>
    <div style="font-size: 9px; font-weight: 600; text-transform: uppercase; opacity: 0.9;">issues</div>
  `;
  
  badge.addEventListener('mouseenter', () => {
    badge.style.transform = 'scale(1.1)';
  });
  
  badge.addEventListener('mouseleave', () => {
    badge.style.transform = 'scale(1)';
  });
  
  badge.addEventListener('click', onClick);
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateY(100px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(badge);
}

// Track manually added elements from interactive mode
const manuallyAddedElements = new Map<string, any>();

// Track current preset index for each element
const elementPresetIndex = new Map<string, { [key: string]: number }>();

// Preset text pools (20 variations each)
const PRESET_POOLS = {
  longName: [
    'María José García-Hernández',
    'Jean-Baptiste François-Marie de la Vallée',
    'Alessandro Giovanni Giuseppe Benedetto',
    'Anastasia Nikolaevna Romanova-Petrova',
    'Muhammad ibn Abdullah al-Rashid',
    'Nguyễn Thị Thanh Hương Mai',
    'José Francisco de San Martín y Matorras',
    'Catherine Elizabeth Middleton Windsor',
    'Wolfgang Amadeus Theophilus Mozart',
    'Ludwig Heinrich Eduard von Beethoven',
    'Siddhartha Gautama Shakyamuni Buddha',
    'Alexander Sergeyevich Pushkin-Gannibal',
    'Isabella Christina Maria Adelaide',
    'Friedrich Wilhelm Heinrich August',
    'Gabriella Sofia Alexandra Victoria',
    'Maximiliano Fernando José de Habsburgo',
    'Constantine Alexandros Papadopoulos',
    'Svetlana Ivanovna Zhukova-Petrova',
    'Francisco Javier González Rodríguez',
    'Elisabeth Marie-Christine von Habsburg'
  ],
  product: [
    'Apple MacBook Pro 16-inch M3 Max with 64GB RAM',
    'Samsung Galaxy Ultra S24+ 5G Titanium Edition',
    'Sony Alpha 7R V Full-Frame Mirrorless Camera',
    'Herman Miller Aeron Ergonomic Office Chair Remastered',
    'Bose QuietComfort Ultra Noise Cancelling Headphones',
    'LG OLED Evo C3 65-inch 4K Smart TV with AI',
    'Microsoft Surface Laptop Studio 2 with NVIDIA RTX',
    'Dell UltraSharp 32 6K Monitor with Thunderbolt',
    'Dyson V15 Detect Absolute Cordless Vacuum Cleaner',
    'Ninja Foodi MAX Multi-Cooker Pressure Fryer',
    'Philips Sonicare DiamondClean Smart 9700 Electric',
    'Breville Barista Touch Impress Espresso Machine',
    'Weber Genesis II S-435 Natural Gas Grill Black',
    'Peloton Bike+ Premium Indoor Exercise Bike Package',
    'Secretlab TITAN Evo 2022 Gaming Chair XL Size',
    'Sonos Arc Premium Smart Soundbar with Dolby Atmos',
    'Google Nest Learning Thermostat Pro 4th Generation',
    'Ring Video Doorbell Pro 2 with 3D Motion Detection',
    'Anova Precision Cooker Nano Sous Vide Immersion',
    'Vitamix Professional Series 750 Heritage Blender'
  ],
  url: [
    'https://www.very-long-domain-name.example.com',
    'https://subdomain.another-long-website-address.co.uk',
    'https://api.v2.production.environment.company.io',
    'https://blog.technology-news-and-updates.org',
    'https://shop.international-electronics-store.net',
    'https://docs.developer-resources-portal.example',
    'https://cdn.static-assets-delivery-network.cloud',
    'https://auth.secure-authentication-service.app',
    'https://mail.enterprise-email-platform.business',
    'https://analytics.data-tracking-dashboard.tech',
    'https://storage.cloud-backup-service-provider.online',
    'https://payments.international-payment-gateway.secure',
    'https://streaming.video-content-delivery.media',
    'https://support.customer-service-helpdesk.help',
    'https://marketplace.digital-products-store.shop',
    'https://forum.community-discussion-platform.social',
    'https://admin.enterprise-management-console.systems',
    'https://portal.professional-services-platform.pro',
    'https://dashboard.business-intelligence-suite.cloud',
    'https://app.project-management-collaboration.work'
  ],
  email: [
    'user.name@company-subdomain.org',
    'firstname.lastname@international-corporation.com',
    'contact.department@global-enterprise-solutions.net',
    'support.team@customer-service-center.co.uk',
    'admin.notifications@system-alerts-platform.io',
    'marketing.campaigns@digital-advertising-agency.com',
    'sales.inquiries@business-development-team.biz',
    'info.requests@information-technology-services.tech',
    'accounts.payable@financial-services-department.org',
    'human.resources@talent-acquisition-office.work',
    'legal.compliance@corporate-governance-division.law',
    'research.development@innovation-laboratory.science',
    'customer.success@client-relations-management.app',
    'product.feedback@quality-assurance-testing.dev',
    'security.alerts@cybersecurity-operations-center.secure',
    'billing.department@accounting-services-firm.finance',
    'technical.support@engineering-services-team.help',
    'media.relations@public-affairs-communications.press',
    'partnership.opportunities@strategic-alliances.partners',
    'investor.relations@corporate-finance-group.invest'
  ],
  longText: [
    'This is an exceptionally long piece of text designed to test how user interfaces handle extended content that spans multiple lines and may cause layout issues.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.',
    'In a world where information flows rapidly and continuously, the ability to process and display extensive textual content efficiently becomes increasingly important for modern applications.',
    'The quick brown fox jumps over the lazy dog multiple times while demonstrating how various typographic systems handle extended sequences of characters in different contextual scenarios.',
    'Product Description: Our revolutionary new device features cutting-edge technology, advanced capabilities, premium materials, exceptional performance, and an innovative design that sets new industry standards.',
    'Customer testimonial: I have been using this service for several years now and I must say that the quality, reliability, and customer support have consistently exceeded my expectations time and time again.',
    'Legal disclaimer: By using this software, you acknowledge and agree to the terms and conditions set forth herein, including but not limited to limitations of liability, warranty disclaimers, and dispute resolution procedures.',
    'Technical specifications: Processor speed 3.5GHz base frequency, 5.0GHz turbo boost, 8 cores, 16 threads, 32MB cache, integrated graphics, support for DDR5-4800 memory, PCIe 5.0 compatibility.',
    'Breaking news update: Researchers at the international scientific conference announced groundbreaking discoveries that could potentially revolutionize our understanding of fundamental principles.',
    'Installation instructions: Before beginning the setup process, please ensure that all prerequisite software components are properly installed and configured according to the detailed documentation provided.',
    'Company mission statement: We strive to deliver innovative solutions that empower individuals and organizations to achieve their goals through technology, collaboration, and sustainable practices.',
    'Error message details: An unexpected exception occurred during the execution of the requested operation due to insufficient system resources or conflicting configuration settings that require immediate attention.',
    'Privacy policy notice: We are committed to protecting your personal information and will only collect, process, and store data in accordance with applicable regulations and industry best practices.',
    'Performance optimization: To achieve maximum efficiency, the system employs advanced caching mechanisms, load balancing algorithms, and distributed processing techniques across multiple server instances.',
    'User feedback response: Thank you for bringing this issue to our attention. Our development team is actively investigating the reported behavior and will provide updates as soon as possible.',
    'Marketing campaign message: Transform your business with our comprehensive suite of integrated tools designed specifically for modern enterprises seeking competitive advantages in dynamic markets.',
    'Academic abstract summary: This research paper examines the complex interrelationships between various factors affecting outcomes and proposes novel methodologies for addressing contemporary challenges.',
    'Environmental impact statement: Our sustainable manufacturing processes minimize waste, reduce carbon emissions, conserve natural resources, and promote circular economy principles throughout the supply chain.',
    'Financial disclosure notice: Past performance is not indicative of future results. Investment values may fluctuate and investors may receive back less than their original investment amount.',
    'Terms of service agreement: These terms govern your access to and use of our services, including any content, functionality, and features offered through our platform or affiliated applications.'
  ]
};

/**
 * Create manual element card (simplified version of auto-scan card)
 */
function createManualElementCard(element: HTMLElement, elementData: any, index: number): HTMLElement {
  const card = document.createElement('div');
  card.setAttribute('data-element-id', elementData.elementId);
  
  card.style.cssText = `
    background: #eff6ff;
    border: 2px solid #3b82f6;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
    font-size: 13px;
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
      ">👆 Manual</div>
    </div>
    
    <div style="color: #1e40af; font-size: 12px; margin-bottom: 12px;">
      "${elementData.originalText}..."
    </div>
    
    <div style="padding-top: 12px; border-top: 1px solid #bfdbfe;">
      <div style="font-weight: 600; color: #1e40af; font-size: 11px; margin-bottom: 6px;">
        🧪 Test with Text:
      </div>
      <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;">
        <button class="preset-btn-manual-${index}" data-preset-type="longName" style="
          background: white;
          border: 1px solid #93c5fd;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">Long Name</button>
        <button class="preset-btn-manual-${index}" data-preset-type="product" style="
          background: white;
          border: 1px solid #93c5fd;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">Product</button>
        <button class="preset-btn-manual-${index}" data-preset-type="url" style="
          background: white;
          border: 1px solid #93c5fd;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">URL</button>
        <button class="preset-btn-manual-${index}" data-preset-type="email" style="
          background: white;
          border: 1px solid #93c5fd;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">Email</button>
        <button class="preset-btn-manual-${index}" data-preset-type="longText" style="
          background: white;
          border: 1px solid #93c5fd;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">Long Text</button>
      </div>
      <textarea 
        id="custom-input-manual-${index}" 
        placeholder="Type your own text..." 
        rows="1"
        style="
          width: 100%;
          border: 1px solid #93c5fd;
          border-radius: 4px;
          padding: 6px 8px;
          font-size: 11px;
          margin-bottom: 6px;
          resize: none;
          overflow: hidden;
          font-family: inherit;
          line-height: 1.4;
        "
      >${elementData.originalText}</textarea>
      <div style="display: flex; gap: 4px;">
        <button class="test-custom-btn-manual" data-issue-index="${index}" style="
          background: #10b981;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          flex: 1;
        ">Test</button>
        <button class="revert-btn-manual" data-issue-index="${index}" style="
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
    
    <div style="display: flex; gap: 4px; margin-top: 8px;">
      <button class="jump-btn-manual" data-issue-index="${index}" style="
        background: #3b82f6;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        flex: 1;
      ">Jump to Element</button>
      <button class="remove-manual-card-btn" data-element-id="${elementData.elementId}" style="
        background: #ef4444;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      ">Remove</button>
    </div>
  `;
  
  // Wire up handlers
  setupManualCardHandlers(card, element, index, elementData.elementId);
  
  return card;
}

/**
 * Setup manual card handlers
 */
function setupManualCardHandlers(card: HTMLElement, element: HTMLElement, index: number, elementId: string): void {
  const textareaId = `custom-input-manual-${index}`;
  
  // Preset buttons with rotation
  card.querySelectorAll(`.preset-btn-manual-${index}`).forEach(btn => {
    btn.addEventListener('click', () => {
      const presetType = (btn as HTMLElement).dataset.presetType as keyof typeof PRESET_POOLS;
      if (!presetType) return;
      
      // Get or initialize preset index for this element
      if (!elementPresetIndex.has(elementId)) {
        elementPresetIndex.set(elementId, {});
      }
      
      const indices = elementPresetIndex.get(elementId)!;
      if (indices[presetType] === undefined) {
        indices[presetType] = 0;
      }
      
      // Get current preset text
      const presetPool = PRESET_POOLS[presetType];
      const text = presetPool[indices[presetType]];
      
      // Rotate to next preset
      indices[presetType] = (indices[presetType] + 1) % presetPool.length;
      
      // Apply to textarea
      const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
      if (textarea && text) {
        textarea.value = text;
        autoExpandTextarea(textarea);
      }
    });
  });
  
  // Auto-expand textarea on input
  const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
  if (textarea) {
    textarea.addEventListener('input', () => autoExpandTextarea(textarea));
  }
  
  // Test button
  card.querySelector('.test-custom-btn-manual')?.addEventListener('click', () => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    const customText = textarea?.value.trim();
    
    if (customText) {
      testElementWithCustomText(element, customText, card);
    }
  });
  
  // Revert button
  const revertBtn = card.querySelector('.revert-btn-manual');
  if (revertBtn) {
    revertBtn.addEventListener('click', () => {
      revertElement(element, card);
    });
  }
  
  // Jump button
  card.querySelector('.jump-btn-manual')?.addEventListener('click', () => {
    highlightAndJumpToElement(element);
  });
  
  // Remove button
  const removeBtn = card.querySelector('.remove-manual-card-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      const elementId = (removeBtn as HTMLElement).dataset.elementId;
      if (elementId) {
        removeManualCard(card, elementId);
      }
    });
  }
}

/**
 * Listen for elements added via interactive mode
 */
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'OVERFLOW_SCOUT_ADD_ELEMENT') {
      addManualElement(event.data.element);
    }
  });
}

/**
 * Add manually clicked element to the list
 */
function addManualElement(elementData: any): void {
  // Check if panel is currently open or collapsed
  const panel = document.getElementById(PANEL_ID);
  const isPanelVisible = panel && panel.style.display !== 'none';
  
  // Check if already added - prevent duplicates
  if (manuallyAddedElements.has(elementData.elementId)) {
    // Only open panel if it was already visible
    if (isPanelVisible) {
      const existingCard = panel!.querySelector(`[data-element-id="${elementData.elementId}"]`);
      if (existingCard) {
        (existingCard as HTMLElement).style.animation = 'flashCard 0.5s';
        // Scroll to card
        existingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      // Just update tab count
      const tab = document.getElementById('overflow-scout-toggle-tab');
      if (tab) {
        updateToggleTabContent(tab);
      }
    }
    return;
  }
  
  // Add to tracked elements
  manuallyAddedElements.set(elementData.elementId, elementData);
  
  // Update toggle tab count (always, preserve current display state)
  const tab = document.getElementById('overflow-scout-toggle-tab');
  if (tab) {
    const isTabVisible = tab.style.display !== 'none';
    updateToggleTabContent(tab, isTabVisible);
  }
  
  // Only open/update panel if it was already visible
  if (isPanelVisible) {
    // Add card to panel
    const content = panel!.querySelector('[data-content-area]') as HTMLElement;
    if (content) {
      // Remove "All Good" empty state if it exists
      const emptyState = content.querySelector('[data-empty-state]');
      if (emptyState) {
        emptyState.remove();
      }
      
      // Find actual element
      const element = document.querySelector(`[data-overflow-scout-id="${elementData.elementId}"]`) as HTMLElement;
      if (element) {
        const card = createManualElementCard(element, elementData, content.children.length);
        content.insertBefore(card, content.firstChild); // Add to top
        // Scroll to new card
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  } else {
    // Panel is collapsed, ensure panel exists but keep it hidden
    if (!panel) {
      // Create panel without showing it
      createResultsPanel([], () => {
        removeResultsPanel();
      });
      
      // Get the newly created panel
      const newPanel = document.getElementById(PANEL_ID);
      if (newPanel) {
        // Hide panel immediately (before animation)
        newPanel.style.display = 'none';
        newPanel.setAttribute('data-panel-open', 'false');
        
        // Make sure tab is visible
        const tab = document.getElementById('overflow-scout-toggle-tab');
        if (tab) {
          updateToggleTabContent(tab, true);
        }
        
        // Add card to hidden panel
        const content = newPanel.querySelector('[data-content-area]') as HTMLElement;
        if (content) {
          const emptyState = content.querySelector('[data-empty-state]');
          if (emptyState) {
            emptyState.remove();
          }
          
          const element = document.querySelector(`[data-overflow-scout-id="${elementData.elementId}"]`) as HTMLElement;
          if (element) {
            const card = createManualElementCard(element, elementData, content.children.length);
            content.insertBefore(card, content.firstChild);
          }
        }
      }
    } else {
      // Panel exists but is hidden, add card silently
      const content = panel.querySelector('[data-content-area]') as HTMLElement;
      if (content) {
        // Remove "All Good" empty state if it exists
        const emptyState = content.querySelector('[data-empty-state]');
        if (emptyState) {
          emptyState.remove();
        }
        
        // Find actual element
        const element = document.querySelector(`[data-overflow-scout-id="${elementData.elementId}"]`) as HTMLElement;
        if (element) {
          const card = createManualElementCard(element, elementData, content.children.length);
          content.insertBefore(card, content.firstChild); // Add to top
        }
      }
      
      // Make sure tab is visible and updated
      const tab = document.getElementById('overflow-scout-toggle-tab');
      if (tab) {
        updateToggleTabContent(tab, true);
      }
    }
  }
}


/**
 * Remove a card from sidebar
 */
function removeCard(card: HTMLElement, issue: OverflowIssue): void {
  // Revert element if it was modified
  if (issue.element.dataset.overflowScoutOriginal) {
    issue.element.textContent = issue.element.dataset.overflowScoutOriginal;
    delete issue.element.dataset.overflowScoutOriginal;
    delete issue.element.dataset.overflowScoutTested;
  }
  
  // Remove card with animation
  card.style.transition = 'opacity 0.3s, transform 0.3s';
  card.style.opacity = '0';
  card.style.transform = 'translateX(100%)';
  
  setTimeout(() => {
    card.remove();
    
    // Close panel if no more cards
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      const content = panel.querySelector('[data-content-area]') as HTMLElement;
      if (content && content.children.length === 0) {
        removeResultsPanel();
      }
    }
  }, 300);
}

/**
 * Remove a manual card from sidebar
 */
function removeManualCard(card: HTMLElement, elementId: string): void {
  // Remove from tracked elements
  manuallyAddedElements.delete(elementId);
  
  // Update toggle tab count (preserve display state)
  const tab = document.getElementById('overflow-scout-toggle-tab');
  if (tab) {
    const isTabVisible = tab.style.display !== 'none';
    updateToggleTabContent(tab, isTabVisible);
  }
  
  // Revert element if it was modified
  const element = document.querySelector(`[data-overflow-scout-id="${elementId}"]`) as HTMLElement;
  if (element && element.dataset.overflowScoutOriginal) {
    element.textContent = element.dataset.overflowScoutOriginal;
    delete element.dataset.overflowScoutOriginal;
    delete element.dataset.overflowScoutTested;
  }
  
  // Remove card with animation
  card.style.transition = 'opacity 0.3s, transform 0.3s';
  card.style.opacity = '0';
  card.style.transform = 'translateX(100%)';
  
  setTimeout(() => {
    card.remove();
    
    // Close panel if no more cards
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      const content = panel.querySelector('[data-content-area]') as HTMLElement;
      if (content && content.children.length === 0) {
        removeResultsPanel();
      }
    }
  }, 300);
}

/**
 * Create results panel showing all issues
 */
export function createResultsPanel(issues: OverflowIssue[], _onClose?: () => void): void {
  removeResultsPanel();
  
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.setAttribute('data-panel-open', 'true');
  
  panel.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100vh;
    background: white;
    box-shadow: -4px 0 24px rgba(0,0,0,0.15);
    z-index: 2147483648;
    display: flex;
    flex-direction: column;
    animation: slideInRight 0.3s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px 20px;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  
  const hasManualElements = manuallyAddedElements.size > 0;
  const totalCount = issues.length + manuallyAddedElements.size;
  
  header.innerHTML = `
    <div style="flex: 1;">
      <div style="font-size: 18px; font-weight: 700;">
        ${totalCount > 0 ? 'Overflow Testing' : 'Scan Complete'}
      </div>
      <div style="font-size: 12px; opacity: 0.9;">
        ${totalCount > 0 ? `${issues.length} auto-scanned${hasManualElements ? ` + ${manuallyAddedElements.size} manual` : ''}` : 'No overflow issues found!'}
      </div>
    </div>
    <div style="display: flex; gap: 8px; align-items: center;">
      <button id="rescan-btn" style="
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 4px;
      " title="Re-run auto scan">
        🔄 Scan
      </button>
      <button id="toggle-interactive-btn" style="
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 4px;
      " title="Toggle interactive mode">
        👆 Interactive
      </button>
      <button id="close-panel" style="
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">×</button>
    </div>
  `;
  
  
  // Content area
  const content = document.createElement('div');
  content.setAttribute('data-content-area', 'true');
  content.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  `;
  
  // Add manually added elements first (from interactive mode)
  manuallyAddedElements.forEach((elementData) => {
    const element = document.querySelector(`[data-overflow-scout-id="${elementData.elementId}"]`) as HTMLElement;
    if (element) {
      const card = createManualElementCard(element, elementData, content.children.length);
      content.appendChild(card);
    }
  });
  
  // Then add auto-scan results
  issues.forEach((issue, index) => {
    const card = createIssueCard(issue, index + manuallyAddedElements.size);
    content.appendChild(card);
  });
  
  // If no issues and no manual elements, show success message
  if (issues.length === 0 && manuallyAddedElements.size === 0) {
    const emptyState = document.createElement('div');
    emptyState.setAttribute('data-empty-state', 'true');
    emptyState.style.cssText = `
      padding: 40px 20px;
      text-align: center;
      color: #10b981;
    `;
    
    emptyState.innerHTML = `
      <div style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #059669;">
        All Good!
      </div>
      <div style="font-size: 14px; color: #6b7280; line-height: 1.6;">
        No overflow issues detected on this page.<br/>
        Your text elements are handling long content properly!
      </div>
    `;
    
    content.appendChild(emptyState);
  }
  
  panel.appendChild(header);
  panel.appendChild(content);
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }
    
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
      }
      to {
        transform: translateX(100%);
      }
    }
    
    @keyframes flashCard {
      0%, 100% {
        background: white;
      }
      50% {
        background: #dbeafe;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Add close handler
  const closeBtn = panel.querySelector('#close-panel');
  closeBtn?.addEventListener('click', () => {
    collapsePanelToTab();
  });
  
  // Add rescan handler
  const rescanBtn = panel.querySelector('#rescan-btn');
  rescanBtn?.addEventListener('click', () => {
    // Send message to re-run auto scan
    window.postMessage({ type: 'OVERFLOW_SCOUT_RESCAN' }, '*');
  });
  
  // Add toggle interactive mode handler
  const interactiveBtn = panel.querySelector('#toggle-interactive-btn');
  interactiveBtn?.addEventListener('click', () => {
    // Send message to toggle interactive mode
    window.postMessage({ type: 'OVERFLOW_SCOUT_TOGGLE_INTERACTIVE' }, '*');
  });
  
  document.body.appendChild(panel);
  
  // Create or show the toggle tab
  ensureToggleTab();
}

/**
 * Create a small tab that stays visible when sidebar is collapsed
 */
function ensureToggleTab(): void {
  let tab = document.getElementById('overflow-scout-toggle-tab');
  
  if (!tab) {
    tab = document.createElement('div');
    tab.id = 'overflow-scout-toggle-tab';
    updateToggleTabContent(tab, false);
    
    document.body.appendChild(tab);
    
    tab.style.cssText = `
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      padding: 12px 6px;
      border-radius: 6px 0 0 6px;
      cursor: pointer;
      z-index: 2147483647;
      box-shadow: -2px 2px 12px rgba(0,0,0,0.2);
      transition: all 0.3s ease;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: auto;
    `;
    
    tab.addEventListener('mouseenter', () => {
      tab!.style.right = '5px';
      tab!.style.boxShadow = '-4px 4px 16px rgba(59, 130, 246, 0.4)';
    });
    
    tab.addEventListener('mouseleave', () => {
      tab!.style.right = '0';
      tab!.style.boxShadow = '-2px 2px 12px rgba(0,0,0,0.2)';
    });
    
    tab.addEventListener('click', () => {
      expandPanelFromTab();
    });
  } else {
    // Update content if tab already exists
    updateToggleTabContent(tab, false);
  }
  
  // Hide tab when panel is open
  tab.style.display = 'none';
}

/**
 * Update toggle tab content with current count
 */
function updateToggleTabContent(tab: HTMLElement, shouldShow: boolean = false): void {
  const manualCount = manuallyAddedElements.size;
  
  tab.innerHTML = `
    <div style="
      writing-mode: vertical-rl;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
      color: white;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
    ">
      <span>OVERFLOW SCOUT</span>
      ${manualCount > 0 ? `<span style="
        background: rgba(255, 255, 255, 0.3);
        border-radius: 12px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 700;
        min-width: 20px;
        text-align: center;
        writing-mode: horizontal-tb;
      ">${manualCount}</span>` : ''}
    </div>
  `;
  
  // Set styles but don't override display - manage it separately
  if (!tab.style.position) {
    tab.style.cssText = `
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      padding: 12px 6px;
      border-radius: 6px 0 0 6px;
      cursor: pointer;
      z-index: 2147483647;
      box-shadow: -2px 2px 12px rgba(0,0,0,0.2);
      transition: all 0.3s ease;
      display: ${shouldShow ? 'block' : 'none'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: auto;
    `;
  } else {
    // Tab already has styles, just update display if needed
    if (shouldShow) {
      tab.style.display = 'block';
    }
  }
}

/**
 * Collapse panel to just the tab
 */
function collapsePanelToTab(): void {
  const panel = document.getElementById(PANEL_ID);
  const tab = document.getElementById('overflow-scout-toggle-tab');
  
  if (panel) {
    panel.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => {
      panel.style.display = 'none';
      panel.setAttribute('data-panel-open', 'false');
    }, 300);
  }
  
  if (tab) {
    setTimeout(() => {
      tab.style.display = 'block';
    }, 300);
  }
}

/**
 * Expand panel from tab
 */
function expandPanelFromTab(): void {
  const panel = document.getElementById(PANEL_ID);
  const tab = document.getElementById('overflow-scout-toggle-tab');
  
  if (tab) {
    tab.style.display = 'none';
  }
  
  if (panel) {
    panel.style.display = 'flex';
    panel.setAttribute('data-panel-open', 'true');
    panel.style.animation = 'slideInRight 0.3s ease-out';
  }
}

/**
 * Create card for single issue
 */
function createIssueCard(issue: OverflowIssue, index: number): HTMLElement {
  const card = document.createElement('div');
  
  const severityColor = issue.severity === 'high' ? '#dc2626' : 
                       issue.severity === 'medium' ? '#f59e0b' : '#3b82f6';
  
  card.style.cssText = `
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-left: 4px solid ${severityColor};
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
    font-size: 13px;
  `;
  
  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
      <div style="font-weight: 600; color: #1f2937; flex: 1;">
        #${index + 1} ${issue.selector}
      </div>
      <div style="
        background: ${severityColor};
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
      ">${issue.severity}</div>
    </div>
    
    <div style="color: #6b7280; font-size: 12px; margin-bottom: 8px;">
      "${issue.originalText}..." → "${issue.testText}..."
    </div>
    
    <div style="margin-bottom: 8px;">
      <div style="font-weight: 600; color: #374151; font-size: 11px; margin-bottom: 4px;">
        🔍 CSS Issues:
      </div>
      ${issue.cssIssues.map(css => `
        <div style="color: #6b7280; font-size: 11px; padding-left: 16px;">• ${css}</div>
      `).join('')}
    </div>
    
    <div>
      <div style="font-weight: 600; color: #374151; font-size: 11px; margin-bottom: 4px;">
        💡 Suggested Fixes:
      </div>
      ${issue.suggestedFixes.map(fix => `
        <div style="
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 6px 8px;
          font-size: 11px;
          color: #1f2937;
          margin-bottom: 4px;
          font-family: 'SF Mono', Monaco, monospace;
        ">${fix}</div>
      `).join('')}
    </div>
    
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
      <div style="font-weight: 600; color: #374151; font-size: 11px; margin-bottom: 6px;">
        🧪 Test with Different Text:
      </div>
      <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;">
        <button class="preset-btn-${index}" data-preset-type="longName" style="
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">Long Name</button>
        <button class="preset-btn-${index}" data-preset-type="product" style="
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">Product</button>
        <button class="preset-btn-${index}" data-preset-type="url" style="
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">URL</button>
        <button class="preset-btn-${index}" data-preset-type="email" style="
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">Email</button>
        <button class="preset-btn-${index}" data-preset-type="longText" style="
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          color: #1e40af;
        ">Long Text</button>
      </div>
      <textarea 
        id="custom-input-${index}" 
        placeholder="Or type your own..." 
        rows="1"
        style="
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 6px 8px;
          font-size: 11px;
          margin-bottom: 6px;
          resize: none;
          overflow: hidden;
          font-family: inherit;
          line-height: 1.4;
        "
      >${issue.originalText}</textarea>
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
    
    <div style="display: flex; gap: 4px; margin-top: 8px;">
      <button class="jump-btn" data-issue-index="${index}" style="
        background: #3b82f6;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        flex: 1;
      ">Jump to Element</button>
      <button class="remove-card-btn" data-issue-index="${index}" style="
        background: #ef4444;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      ">Remove</button>
    </div>
  `;
  
  // Preset buttons handler with rotation
  card.querySelectorAll(`.preset-btn-${index}`).forEach(btn => {
    btn.addEventListener('click', () => {
      const presetType = (btn as HTMLElement).dataset.presetType as keyof typeof PRESET_POOLS;
      if (!presetType) return;
      
      // Use element's memory address as unique ID
      const elementId = `auto-${index}`;
      
      // Get or initialize preset index for this element
      if (!elementPresetIndex.has(elementId)) {
        elementPresetIndex.set(elementId, {});
      }
      
      const indices = elementPresetIndex.get(elementId)!;
      if (indices[presetType] === undefined) {
        indices[presetType] = 0;
      }
      
      // Get current preset text
      const presetPool = PRESET_POOLS[presetType];
      const text = presetPool[indices[presetType]];
      
      // Rotate to next preset
      indices[presetType] = (indices[presetType] + 1) % presetPool.length;
      
      // Apply to textarea
      const textarea = document.getElementById(`custom-input-${index}`) as HTMLTextAreaElement;
      if (textarea && text) {
        textarea.value = text;
        autoExpandTextarea(textarea);
      }
    });
  });
  
  // Auto-expand textarea on input
  const textarea = document.getElementById(`custom-input-${index}`) as HTMLTextAreaElement;
  if (textarea) {
    textarea.addEventListener('input', () => autoExpandTextarea(textarea));
  }
  
  // Test with custom text handler
  card.querySelector('.test-custom-btn')?.addEventListener('click', () => {
    const textarea = document.getElementById(`custom-input-${index}`) as HTMLTextAreaElement;
    const customText = textarea?.value.trim();
    
    if (customText) {
      testElementWithCustomText(issue.element, customText, card);
    }
  });
  
  // Revert button handler
  card.querySelector('.revert-btn')?.addEventListener('click', () => {
    revertElement(issue.element, card);
  });
  
  // Jump to element handler
  card.querySelector('.jump-btn')?.addEventListener('click', () => {
    highlightAndJumpToElement(issue.element);
  });
  
  // Remove card handler
  card.querySelector('.remove-card-btn')?.addEventListener('click', () => {
    removeCard(card, issue);
  });
  
  return card;
}

/**
 * Auto-expand textarea based on content
 */
function autoExpandTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

/**
 * Enable revert button for a card
 */
function enableRevertButton(card: HTMLElement): void {
  const revertBtn = card.querySelector('.revert-btn, .revert-btn-manual') as HTMLButtonElement;
  if (revertBtn) {
    revertBtn.disabled = false;
    revertBtn.style.opacity = '1';
    revertBtn.style.pointerEvents = 'auto';
    revertBtn.style.background = '#f59e0b';
  }
}

/**
 * Revert element to original text
 */
function revertElement(element: HTMLElement, card: HTMLElement): void {
  const original = element.dataset.overflowScoutOriginal;
  
  if (original !== undefined) {
    element.textContent = original;
    delete element.dataset.overflowScoutOriginal;
    delete element.dataset.overflowScoutTested;
    
    // Disable revert button (works for both regular and manual cards)
    const revertBtn = card.querySelector('.revert-btn, .revert-btn-manual') as HTMLButtonElement;
    if (revertBtn) {
      revertBtn.disabled = true;
      revertBtn.style.opacity = '0.5';
      revertBtn.style.pointerEvents = 'none';
      revertBtn.style.background = '#6b7280';
    }
    
    // Clear test results
    card.querySelectorAll('.test-result').forEach(r => r.remove());
    
    // Show success message
    const message = document.createElement('div');
    message.style.cssText = `
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 4px;
      padding: 8px;
      margin-top: 8px;
      font-size: 11px;
      color: #16a34a;
      font-weight: 600;
    `;
    message.textContent = '✅ Reverted to original text';
    message.className = 'test-result';
    card.appendChild(message);
    
    setTimeout(() => {
      message.style.transition = 'opacity 0.3s';
      message.style.opacity = '0';
      setTimeout(() => message.remove(), 300);
    }, 2000);
  }
}

/**
 * Test specific element with custom text (actually modifies the element)
 */
function testElementWithCustomText(element: HTMLElement, customText: string, card: HTMLElement): void {
  // Store original text if not already stored
  if (!element.dataset.overflowScoutOriginal) {
    element.dataset.overflowScoutOriginal = element.textContent || '';
  }
  
  // Replace the element's text
  element.textContent = customText;
  
  // Mark as tested
  element.dataset.overflowScoutTested = 'true';
  
  // Check for overflow after render
  setTimeout(() => {
    const isOverflowing = element.scrollWidth > element.clientWidth || 
                         element.scrollHeight > element.clientHeight;
    
    // Show result and enable revert button
    showTestResult(isOverflowing, customText, card, element);
    enableRevertButton(card);
  }, 100);
}

/**
 * Show test result
 */
function showTestResult(isOverflowing: boolean, customText: string, card: HTMLElement, _element: HTMLElement): void {
  const result = document.createElement('div');
  result.style.cssText = `
    background: ${isOverflowing ? '#fef2f2' : '#f0fdf4'};
    border: 1px solid ${isOverflowing ? '#fecaca' : '#bbf7d0'};
    border-radius: 4px;
    padding: 8px;
    margin-top: 8px;
    font-size: 11px;
  `;
  
  result.innerHTML = `
    <div style="font-weight: 600; color: ${isOverflowing ? '#dc2626' : '#16a34a'}; margin-bottom: 4px;">
      ${isOverflowing ? '❌ Overflows' : '✅ Fits!'} with "${customText.substring(0, 40)}${customText.length > 40 ? '...' : ''}"
    </div>
    <div style="color: #6b7280; font-size: 10px;">
      ${isOverflowing ? 'Element text changed on page. Click Revert to restore.' : 'Text changed on page and fits! Click Revert to restore.'}
    </div>
  `;
  
  // Remove old results
  card.querySelectorAll('.test-result').forEach(r => r.remove());
  result.className = 'test-result';
  
  card.appendChild(result);
}

/**
 * Update existing results panel with new issues (no animation)
 */
export function updateResultsPanel(issues: OverflowIssue[]): void {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  
  // Update header
  const header = panel.querySelector('div:first-child');
  if (header) {
    const hasManualElements = manuallyAddedElements.size > 0;
    const totalCount = issues.length + manuallyAddedElements.size;
    
    header.innerHTML = `
      <div>
        <div style="font-size: 18px; font-weight: 700;">
          ${totalCount > 0 ? 'Overflow Testing' : 'Scan Complete'}
        </div>
        <div style="font-size: 12px; opacity: 0.9;">
          ${totalCount > 0 ? `${issues.length} auto-scanned${hasManualElements ? ` + ${manuallyAddedElements.size} manual` : ''}` : 'No overflow issues found!'}
        </div>
      </div>
      <button id="close-panel" style="
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">×</button>
    `;
    
    // Re-attach close handler
    const closeBtn = header.querySelector('#close-panel');
    closeBtn?.addEventListener('click', () => removeResultsPanel());
  }
  
  // Update content
  const content = panel.querySelector('[data-content-area]') as HTMLElement;
  if (content) {
    // Clear all auto-scan cards (keep manual ones)
    const autoCards = content.querySelectorAll('[data-issue-card]');
    autoCards.forEach(card => card.remove());
    
    // Clear empty state
    const emptyState = content.querySelector('[data-empty-state]');
    if (emptyState) {
      emptyState.remove();
    }
    
    // Add new auto-scan results after manual cards
    issues.forEach((issue, index) => {
      const card = createIssueCard(issue, index + manuallyAddedElements.size);
      card.setAttribute('data-issue-card', 'true');
      content.appendChild(card);
    });
    
    // If no issues and no manual elements, show success message
    if (issues.length === 0 && manuallyAddedElements.size === 0) {
      const newEmptyState = document.createElement('div');
      newEmptyState.setAttribute('data-empty-state', 'true');
      newEmptyState.style.cssText = `
        padding: 40px 20px;
        text-align: center;
        color: #10b981;
      `;
      
      newEmptyState.innerHTML = `
        <div style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #059669;">
          All Good!
        </div>
        <div style="font-size: 14px; color: #6b7280; line-height: 1.6;">
          No overflow issues detected on this page.<br/>
          Your text elements are handling long content properly!
        </div>
      `;
      
      content.appendChild(newEmptyState);
    }
  }
}

/**
 * Remove results panel and tab
 */
export function removeResultsPanel(): void {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.remove();
  
  const tab = document.getElementById('overflow-scout-toggle-tab');
  if (tab) tab.remove();
}

/**
 * Check if panel is open
 */
export function isPanelOpen(): boolean {
  return document.getElementById(PANEL_ID) !== null;
}

/**
 * Highlight and jump to element with VERY obvious visual feedback
 */
function highlightAndJumpToElement(element: HTMLElement): void {
  // Check if element is actually visible
  const styles = window.getComputedStyle(element);
  const isHidden = styles.display === 'none' || 
                   styles.visibility === 'hidden' || 
                   styles.opacity === '0';
  
  if (isHidden) {
    // Show alert that element is hidden
    showHiddenElementWarning(element);
    return;
  }
  
  // Scroll to element
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Create animated spotlight overlay
  const spotlight = document.createElement('div');
  spotlight.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483646;
    border: 4px solid #3b82f6;
    border-radius: 8px;
    background: rgba(59, 130, 246, 0.1);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3),
                0 0 20px 8px rgba(59, 130, 246, 0.4),
                inset 0 0 20px rgba(59, 130, 246, 0.2);
    animation: pulseSpotlight 1.5s ease-in-out infinite;
  `;
  
  // Add pulsing animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulseSpotlight {
      0%, 100% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.05);
        opacity: 0.8;
      }
    }
    
    @keyframes arrowBounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-10px);
      }
    }
  `;
  document.head.appendChild(style);
  
  // Position spotlight over element (using fixed positioning relative to viewport)
  const updatePosition = () => {
    const rect = element.getBoundingClientRect();
    spotlight.style.top = `${rect.top - 8}px`;
    spotlight.style.left = `${rect.left - 8}px`;
    spotlight.style.width = `${rect.width + 16}px`;
    spotlight.style.height = `${rect.height + 16}px`;
  };
  
  updatePosition();
  document.body.appendChild(spotlight);
  
  // Create animated arrow pointing to element
  const arrow = document.createElement('div');
  arrow.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483647;
    font-size: 48px;
    animation: arrowBounce 0.8s ease-in-out infinite;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  `;
  arrow.textContent = '👇';
  
  const positionArrow = () => {
    const rect = element.getBoundingClientRect();
    arrow.style.top = `${rect.top - 60}px`;
    arrow.style.left = `${rect.left + rect.width / 2 - 24}px`;
  };
  
  positionArrow();
  document.body.appendChild(arrow);
  
  // Create label showing what element it is
  const label = document.createElement('div');
  const selector = generateSimpleSelector(element);
  label.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483647;
    background: #3b82f6;
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    white-space: nowrap;
  `;
  label.textContent = `← ${selector}`;
  
  const positionLabel = () => {
    const rect = element.getBoundingClientRect();
    const labelTop = rect.top + rect.height / 2 - 20;
    const labelLeft = rect.right + 16;
    
    // Keep label on screen
    label.style.top = `${labelTop}px`;
    label.style.left = `${Math.min(labelLeft, window.innerWidth - 250)}px`;
  };
  
  positionLabel();
  document.body.appendChild(label);
  
  // Update positions on scroll
  const scrollHandler = () => {
    updatePosition();
    positionArrow();
    positionLabel();
  };
  window.addEventListener('scroll', scrollHandler);
  
  // Remove after 4 seconds
  setTimeout(() => {
    spotlight.style.transition = 'opacity 0.5s';
    spotlight.style.opacity = '0';
    arrow.style.transition = 'opacity 0.5s';
    arrow.style.opacity = '0';
    label.style.transition = 'opacity 0.5s';
    label.style.opacity = '0';
    
    setTimeout(() => {
      spotlight.remove();
      arrow.remove();
      label.remove();
      style.remove();
      window.removeEventListener('scroll', scrollHandler);
    }, 500);
  }, 4000);
}

/**
 * Generate simple selector for label
 */
function generateSimpleSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`;
  }
  
  const classes = element.className && typeof element.className === 'string'
    ? element.className.trim().split(/\s+/).slice(0, 2).join('.')
    : '';
  
  if (classes) {
    return `${element.tagName.toLowerCase()}.${classes}`;
  }
  
  return element.tagName.toLowerCase();
}

/**
 * Show warning when trying to jump to hidden element
 */
function showHiddenElementWarning(element: HTMLElement): void {
  const warning = document.createElement('div');
  const selector = generateSimpleSelector(element);
  
  warning.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
    color: white;
    padding: 24px 32px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-align: center;
    max-width: 400px;
  `;
  
  warning.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
    <div style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">
      Element is Hidden
    </div>
    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">
      <code style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-family: monospace;">
        ${selector}
      </code>
    </div>
    <div style="font-size: 13px; opacity: 0.9; margin-bottom: 16px;">
      This element has <code style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px;">visibility: hidden</code>, 
      <code style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px;">display: none</code>, 
      or <code style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px;">opacity: 0</code>
    </div>
    <div style="font-size: 12px; opacity: 0.8;">
      This shouldn't have been flagged. It will be filtered in the next scan.
    </div>
  `;
  
  document.body.appendChild(warning);
  
  // Remove after 4 seconds
  setTimeout(() => {
    warning.style.transition = 'opacity 0.3s';
    warning.style.opacity = '0';
    setTimeout(() => warning.remove(), 300);
  }, 4000);
}
