/**
 * Auto Badge - New sidebar-based results panel
 * Shows overflow issues in a collapsible sidebar
 */

import type { OverflowIssue } from './autoScanner';
import { showOnboardingTooltip } from './onboarding';
import { injectDarkModeStyles, applyDarkMode, toggleDarkMode } from './darkMode';

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
    'This is an exceptionally long piece of text specifically designed to rigorously test how user interfaces handle extended content that spans multiple lines, potentially causing overflow, truncation, or other layout issues in constrained spaces with limited width or height restrictions.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident.',
    'In a world where information flows rapidly and continuously across multiple channels and platforms, the ability to process, display, and manage extensive textual content efficiently and elegantly becomes increasingly important for modern web applications, mobile interfaces, and desktop software solutions.',
    'The quick brown fox jumps over the lazy dog multiple times in succession while simultaneously demonstrating how various typographic rendering systems and layout algorithms handle extended sequences of alphanumeric characters in different contextual scenarios, edge cases, and viewport configurations.',
    'Product Description: Our revolutionary new flagship device features cutting-edge quantum processing technology, advanced machine learning capabilities, military-grade premium aerospace materials, exceptional real-world performance metrics, innovative ergonomic industrial design, breakthrough battery efficiency, professional-grade camera systems, and sets entirely new industry standards for excellence.',
    'Customer testimonial: I have been continuously using this exceptional service platform for several years now across multiple projects and deployments, and I must enthusiastically say that the outstanding quality, unwavering reliability, comprehensive documentation, responsive customer support team, and innovative feature releases have consistently exceeded my highest expectations time and time again without fail.',
    'Legal disclaimer: By accessing, downloading, installing, or using this software application or any of its associated services, you explicitly acknowledge that you have read, understood, and agree to be legally bound by all terms and conditions set forth herein, including but not limited to comprehensive limitations of liability, express and implied warranty disclaimers, mandatory arbitration clauses, and alternative dispute resolution procedures.',
    'Technical specifications: Multi-core processor with 3.5GHz base frequency and intelligent 5.0GHz turbo boost technology, 8 high-performance cores with simultaneous multithreading supporting 16 parallel threads, 32MB shared L3 cache memory, integrated advanced graphics processing unit, native support for high-speed DDR5-4800 memory modules, PCIe 5.0 compatibility for next-generation peripherals.',
    'Breaking news update: Distinguished researchers and leading scientists at the prestigious international scientific conference and symposium announced multiple groundbreaking discoveries and revolutionary findings that could potentially and fundamentally revolutionize our comprehensive understanding of core scientific principles, theoretical frameworks, and practical applications across numerous disciplines.',
    'Installation instructions: Before beginning the comprehensive step-by-step setup and configuration process, please carefully ensure that all mandatory prerequisite software components, system libraries, runtime environments, and dependency packages are properly downloaded, installed, verified, and correctly configured according to the detailed technical documentation, troubleshooting guides, and best practices provided.',
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
  card.setAttribute('data-manual-card', 'true');
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
      <div style="font-weight: 600; color: #2563eb; flex: 1;">
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
    
    <div style="color: #3b82f6; font-size: 12px; margin-bottom: 12px;">
      "${elementData.originalText}..."
    </div>
    
    <div style="padding-top: 12px; border-top: 1px solid #bfdbfe;">
      <div style="font-weight: 600; color: #2563eb; font-size: 11px; margin-bottom: 6px;">
        🧪 Test with Text:
      </div>
      <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;">
        <button class="preset-btn-manual-${index} os-preset-btn os-preset-btn-manual" data-preset-type="longName">Long Name</button>
        <button class="preset-btn-manual-${index} os-preset-btn os-preset-btn-manual" data-preset-type="product">Product</button>
        <button class="preset-btn-manual-${index} os-preset-btn os-preset-btn-manual" data-preset-type="url">URL</button>
        <button class="preset-btn-manual-${index} os-preset-btn os-preset-btn-manual" data-preset-type="email">Email</button>
        <button class="preset-btn-manual-${index} os-preset-btn os-preset-btn-manual" data-preset-type="longText">Long Text</button>
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
        <button class="test-btn-manual" data-issue-index="${index}" style="
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
      <button class="screenshot-btn-manual" style="
        background: #8b5cf6;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        flex: 1;
      ">📸 Capture</button>
      <button class="jump-btn-manual" style="
        background: #10b981;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        flex: 1;
      ">Jump</button>
      <button class="remove-manual-card-btn" data-element-id="${elementData.elementId}" style="
        background: #ef4444;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        flex: 1;
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
  card.querySelector('.test-btn-manual')?.addEventListener('click', () => {
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
      revertElement(card, elementId);
    });
  }
  
  // Screenshot button
  card.querySelector('.screenshot-btn-manual')?.addEventListener('click', async () => {
    await captureElementScreenshot(element, {
      selector: elementId,
      testText: element.textContent?.substring(0, 40) || '',
      severity: 'manual'
    });
  });
  
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
  
  // Copy selector button
  card.querySelector('.copy-selector-btn')?.addEventListener('click', async () => {
    try {
      const selectorText = card.querySelector('.selector-text')?.textContent || '';
      await navigator.clipboard.writeText(selectorText);
      showToast('📋 Selector copied!', 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast('❌ Copy failed', 'error');
    }
  });
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
  
  // Revert element if it was modified and remove ALL tracking
  const element = document.querySelector(`[data-overflow-scout-id="${elementId}"]`) as HTMLElement;
  if (element) {
    if (element.dataset.overflowScoutOriginal) {
      element.textContent = element.dataset.overflowScoutOriginal;
    }
    delete element.dataset.overflowScoutOriginal;
    delete element.dataset.overflowScoutTested;
    delete element.dataset.overflowScoutManual;
    delete element.dataset.overflowScoutId; // ✅ Remove ID so it can be re-added
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
  
  // Show onboarding on first use (after panel is fully rendered)
  setTimeout(() => {
    console.log('[Overflow Scout] Attempting to show onboarding...');
    showOnboardingTooltip();
  }, 600);
  
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.setAttribute('data-panel-open', 'true');
  
  panel.style.cssText = `
    all: initial;
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    width: 400px !important;
    height: 100vh !important;
    background: white !important;
    box-shadow: -2px 0 20px rgba(0, 0, 0, 0.15) !important;
    z-index: 2147483648 !important;
    display: flex !important;
    flex-direction: column !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
    color: #111827 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-sizing: border-box !important;
    animation: slideInRight 0.3s ease-out;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px 20px;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    color: white;
    display: flex;
    flex-direction: column;
    gap: 12px;
  `;
  
  header.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
      <div style="flex: 1;">
        <div style="font-size: 18px; font-weight: 700;">
          <span style="font-size: 24px;">🔍</span>
          Overflow Testing
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="dark-mode-toggle" class="os-button os-btn-icon" title="Toggle dark mode">🌙</button>
        <button id="close-panel" class="os-button os-btn-icon os-btn-close" title="Collapse sidebar">×</button>
      </div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="rescan-btn" class="os-button os-btn-action" title="Re-run scan (Ctrl+Shift+O)">
        <span style="font-size: 14px;">🔄</span>
        <span>Scan</span>
      </button>
      <button id="toggle-interactive-btn" class="os-button os-btn-action" title="Start interactive mode" data-active="false">
        <span style="font-size: 14px;">👆</span>
        <span id="interactive-btn-text">Start</span>
      </button>
    </div>
    <div style="
      border-top: 1px solid rgba(255,255,255,0.2);
      padding-top: 8px;
      margin-top: 8px;
      display: flex;
      gap: 6px;
    ">
      <button id="test-all-btn" class="os-button os-btn-batch" title="Test all elements with random long text">
        🧪 Test All
      </button>
      <button id="revert-all-btn" class="os-button os-btn-batch" title="Revert all elements to original">
        ↩️ Revert All
      </button>
      <button id="export-all-btn" class="os-button os-btn-batch" title="Export all results as JSON">
        📦 Export
      </button>
      <button id="clear-all-btn" class="os-button os-btn-batch" title="Clear all cards and reset">
        🗑️ Clear All
      </button>
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
      <div style="font-size: 13px; color: #6b7280;">
        No overflow issues detected on this page.<br/>
        Your text elements are handling long content properly!
      </div>
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <a href="https://www.linkedin.com/in/basel-issmail/" target="_blank" rel="noopener noreferrer" style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #6b7280;
          text-decoration: none;
          transition: color 0.2s;
        " onmouseover="this.style.color='#0a66c2'" onmouseout="this.style.color='#6b7280'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Made by Basel Issmail
        </a>
      </div>
    `;
    
    content.appendChild(emptyState);
  }
  
  panel.appendChild(header);
  panel.appendChild(content);
  
  // Add subtle footer credit
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 8px 16px;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
    text-align: center;
  `;
  footer.innerHTML = `
    <a href="https://www.linkedin.com/in/basel-issmail/" target="_blank" rel="noopener noreferrer" style="
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #9ca3af;
      text-decoration: none;
      transition: color 0.2s;
    " onmouseover="this.style.color='#0a66c2'" onmouseout="this.style.color='#9ca3af'">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
      Made by Basel Issmail
    </a>
  `;
  panel.appendChild(footer);
  
  // Add animation and CSS isolation
  const style = document.createElement('style');
  style.textContent = `
    /* Animation */
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }
    
    /* CSS Isolation for Extension Panel - Smart reset that preserves inline styles */
    #overflow-scout-results-panel {
      /* Force consistent box model */
      box-sizing: border-box !important;
      
      /* Prevent font inheritance issues */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
      
      /* Isolate from website styles without breaking inline styles */
      text-transform: none !important;
      text-decoration: none !important;
      text-shadow: none !important;
      float: none !important;
      clear: none !important;
      list-style: none !important;
    }
    
    #overflow-scout-results-panel * {
      /* Only reset non-layout properties that might interfere */
      box-sizing: border-box !important;
      font-family: inherit !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
      text-transform: none !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
      quotes: none !important;
      float: none !important;
      clear: none !important;
      vertical-align: baseline !important;
      list-style: none !important;
      transform: none !important;
      animation: none !important;
      transition: none !important;
    }
    
    /* Button base reset - high specificity */
    #overflow-scout-results-panel .os-button,
    #overflow-scout-results-panel .os-preset-btn {
      all: unset !important;
      display: inline-block !important;
      box-sizing: border-box !important;
      cursor: pointer !important;
      user-select: none !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    }
    
    /* Header buttons */
    #overflow-scout-results-panel .os-btn-icon {
      background: rgba(255,255,255,0.2) !important;
      border: none !important;
      color: white !important;
      width: 28px !important;
      height: 28px !important;
      border-radius: 6px !important;
      font-size: 14px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0 !important;
    }
    
    #overflow-scout-results-panel .os-btn-close {
      font-size: 16px !important;
    }
    
    /* Action buttons */
    #overflow-scout-results-panel .os-btn-action {
      background: rgba(255,255,255,0.15) !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
      color: white !important;
      padding: 8px 14px !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      transition: all 0.2s !important;
      flex: 1 !important;
    }
    
    /* Batch operation buttons */
    #overflow-scout-results-panel .os-btn-batch {
      background: rgba(255,255,255,0.1) !important;
      border: 1px solid rgba(255,255,255,0.15) !important;
      color: white !important;
      padding: 6px 10px !important;
      border-radius: 4px !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      flex: 1 !important;
      transition: all 0.2s !important;
    }
    
    #overflow-scout-results-panel .os-btn-batch:hover {
      background: rgba(255,255,255,0.2) !important;
    }
    
    /* Preset buttons */
    #overflow-scout-results-panel .os-preset-btn {
      background: #eff6ff !important;
      border: 1px solid #bfdbfe !important;
      padding: 3px 6px !important;
      border-radius: 3px !important;
      font-size: 10px !important;
      color: #2563eb !important;
    }
    
    #overflow-scout-results-panel .os-preset-btn-manual {
      background: white !important;
      border: 1px solid #93c5fd !important;
      padding: 3px 6px !important;
      border-radius: 3px !important;
      font-size: 10px !important;
      color: #2563eb !important;
    }
    
    /* Card styles */
    #overflow-scout-results-panel .os-card {
      background: #f9fafb !important;
      border: 1px solid #e5e7eb !important;
      border-radius: 8px !important;
      padding: 12px !important;
      margin-bottom: 12px !important;
      font-size: 13px !important;
    }
    
    #overflow-scout-results-panel .os-card-severity-high {
      border-left: 4px solid #dc2626 !important;
    }
    
    #overflow-scout-results-panel .os-card-severity-medium {
      border-left: 4px solid #f59e0b !important;
    }
    
    #overflow-scout-results-panel .os-card-severity-low {
      border-left: 4px solid #3b82f6 !important;
    }
    
    #overflow-scout-results-panel .os-card-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      margin-bottom: 8px !important;
    }
    
    #overflow-scout-results-panel .os-card-title {
      font-weight: 600 !important;
      color: #111827 !important;
      flex: 1 !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
    }
    
    #overflow-scout-results-panel .os-selector-text {
      font-family: monospace !important;
      font-size: 11px !important;
      color: #6b7280 !important;
    }
    
    #overflow-scout-results-panel .os-btn-copy {
      background: transparent !important;
      border: none !important;
      color: #6b7280 !important;
      padding: 2px 4px !important;
      font-size: 10px !important;
    }
    
    #overflow-scout-results-panel .os-btn-copy:hover {
      color: #3b82f6 !important;
    }
    
    #overflow-scout-results-panel .os-severity-badge {
      padding: 2px 6px !important;
      border-radius: 4px !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      text-transform: uppercase !important;
      color: white !important;
    }
    
    #overflow-scout-results-panel .os-severity-high {
      background: #dc2626 !important;
    }
    
    #overflow-scout-results-panel .os-severity-medium {
      background: #f59e0b !important;
    }
    
    #overflow-scout-results-panel .os-severity-low {
      background: #3b82f6 !important;
    }
    
    #overflow-scout-results-panel input,
    #overflow-scout-results-panel textarea {
      font-family: inherit !important;
    }
    
    /* Prevent text selection issues */
    #overflow-scout-results-panel {
      -webkit-user-select: text !important;
      user-select: text !important;
    }
    
    /* Ensure scrolling works */
    #overflow-scout-results-panel [data-content-area] {
      overflow-y: auto !important;
      overflow-x: hidden !important;
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
  
  // Inject dark mode styles and apply theme
  injectDarkModeStyles();
  
  // Initialize theme from chrome.storage
  const initializeTheme = () => {
    chrome.storage.local.get(['overflowScoutDarkMode'], (result) => {
      let isDark = false;
      
      if (result.overflowScoutDarkMode === undefined) {
        // First time - use system preference
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        chrome.storage.local.set({ overflowScoutDarkMode: isDark });
        localStorage.setItem('overflow-scout-dark-mode', isDark.toString());
      } else {
        isDark = result.overflowScoutDarkMode;
        localStorage.setItem('overflow-scout-dark-mode', isDark.toString());
      }
      
      applyDarkMode(isDark);
      
      // Update toggle button
      const darkModeToggle = panel.querySelector('#dark-mode-toggle');
      if (darkModeToggle) {
        darkModeToggle.textContent = isDark ? '☀️' : '🌙';
      }
    });
  };
  
  initializeTheme();
  
  // Add close handler
  const closeBtn = panel.querySelector('#close-panel');
  closeBtn?.addEventListener('click', () => {
    collapsePanelToTab();
  });
  
  // Add dark mode toggle handler
  const darkModeToggle = panel.querySelector('#dark-mode-toggle');
  darkModeToggle?.addEventListener('click', () => {
    const isDark = toggleDarkMode();
    if (darkModeToggle) {
      darkModeToggle.textContent = isDark ? '☀️' : '🌙';
    }
  });
  
  // Listen for theme changes from chrome.storage (popup or other tabs)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.overflowScoutDarkMode) {
      const isDark = changes.overflowScoutDarkMode.newValue;
      applyDarkMode(isDark);
      
      const toggle = panel.querySelector('#dark-mode-toggle');
      if (toggle) {
        toggle.textContent = isDark ? '☀️' : '🌙';
      }
    }
  });
  
  // Add rescan handler
  const rescanBtn = panel.querySelector('#rescan-btn');
  rescanBtn?.addEventListener('click', () => {
    const btnElement = rescanBtn as HTMLElement;
    const originalHTML = btnElement.innerHTML;
    
    // Add loading state
    btnElement.innerHTML = '<span style="font-size: 14px;">⏳</span><span>Scanning...</span>';
    btnElement.style.pointerEvents = 'none';
    btnElement.style.opacity = '0.7';
    
    // Send message to re-run auto scan
    window.postMessage({ type: 'OVERFLOW_SCOUT_RESCAN' }, '*');
    
    // Reset button after scan
    setTimeout(() => {
      btnElement.innerHTML = originalHTML;
      btnElement.style.pointerEvents = 'auto';
      btnElement.style.opacity = '1';
    }, 2000);
  });
  
  // Add toggle interactive mode handler
  const interactiveBtn = panel.querySelector('#toggle-interactive-btn') as HTMLElement;
  const interactiveBtnText = panel.querySelector('#interactive-btn-text');
  
  interactiveBtn?.addEventListener('click', () => {
    const isActive = interactiveBtn.dataset.active === 'true';
    
    // Toggle state
    interactiveBtn.dataset.active = (!isActive).toString();
    
    // Update button appearance
    if (!isActive) {
      // Starting interactive mode
      interactiveBtn.style.background = 'rgba(255,255,255,0.3)';
      interactiveBtn.style.borderColor = 'rgba(255,255,255,0.4)';
      if (interactiveBtnText) interactiveBtnText.textContent = 'Stop';
      interactiveBtn.title = 'Stop interactive mode';
    } else {
      // Stopping interactive mode
      interactiveBtn.style.background = 'rgba(255,255,255,0.15)';
      interactiveBtn.style.borderColor = 'rgba(255,255,255,0.2)';
      if (interactiveBtnText) interactiveBtnText.textContent = 'Start';
      interactiveBtn.title = 'Start interactive mode';
    }
    
    // Send message to toggle interactive mode
    window.postMessage({ type: 'OVERFLOW_SCOUT_TOGGLE_INTERACTIVE' }, '*');
  });
  
  // Batch operations handlers
  panel.querySelector('#test-all-btn')?.addEventListener('click', () => {
    testAllElements(panel);
  });
  
  panel.querySelector('#revert-all-btn')?.addEventListener('click', () => {
    const content = panel.querySelector('[data-content-area]') as HTMLElement;
    if (content) {
      const allCards = content.querySelectorAll('[data-issue-card], [data-manual-card]');
      let revertedCount = 0;
      
      // Revert each element's text (DON'T remove cards or tracking)
      allCards.forEach((card) => {
        const cardElement = card as HTMLElement;
        
        // Check if it's a manual card or issue card
        if (cardElement.hasAttribute('data-manual-card')) {
          const elementId = cardElement.dataset.elementId;
          if (elementId) {
            const element = document.querySelector(`[data-overflow-scout-id="${elementId}"]`) as HTMLElement;
            // Skip if element is inside the extension panel
            if (element && element.dataset.overflowScoutOriginal && !element.closest('#overflow-scout-results-panel')) {
              // Only revert the text
              element.textContent = element.dataset.overflowScoutOriginal;
              revertedCount++;
              
              // Reset textarea to show original text
              const textarea = cardElement.querySelector('textarea') as HTMLTextAreaElement;
              if (textarea) {
                textarea.value = element.dataset.overflowScoutOriginal;
                textarea.placeholder = 'Original text restored';
              }
              
              // Update revert button state
              const revertBtn = cardElement.querySelector('.revert-btn-manual') as HTMLButtonElement;
              if (revertBtn) {
                revertBtn.disabled = true;
                revertBtn.style.opacity = '0.5';
                revertBtn.style.pointerEvents = 'none';
                revertBtn.style.background = '#6b7280';
              }
              
              // Clear test results
              cardElement.querySelectorAll('.test-result').forEach(r => r.remove());
              
              // Show success message in card
              const successMsg = document.createElement('div');
              successMsg.className = 'test-result';
              successMsg.style.cssText = `
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
                border-radius: 4px;
                padding: 8px;
                margin-top: 8px;
                font-size: 11px;
                font-weight: 600;
                color: #15803d;
              `;
              successMsg.textContent = '✅ Reverted to original text';
              cardElement.appendChild(successMsg);
              
              setTimeout(() => {
                successMsg.style.transition = 'opacity 0.3s';
                successMsg.style.opacity = '0';
                setTimeout(() => successMsg.remove(), 300);
              }, 2000);
            }
          }
        } else if (cardElement.hasAttribute('data-issue-card')) {
          // Revert auto-scan issue
          const issue = (cardElement as any).__overflowScoutIssue;
          // Skip if element is inside the extension panel
          if (issue?.element && issue.element.dataset.overflowScoutOriginal && !issue.element.closest('#overflow-scout-results-panel')) {
            issue.element.textContent = issue.element.dataset.overflowScoutOriginal;
            revertedCount++;
            
            // Reset textarea to show original text (auto-scan cards also have textareas)
            const textarea = cardElement.querySelector('textarea') as HTMLTextAreaElement;
            if (textarea) {
              textarea.value = issue.element.dataset.overflowScoutOriginal;
              textarea.placeholder = 'Original text restored';
            }
            
            // Update revert button state
            const revertBtn = cardElement.querySelector('.revert-btn') as HTMLButtonElement;
            if (revertBtn) {
              revertBtn.disabled = true;
              revertBtn.style.opacity = '0.5';
              revertBtn.style.pointerEvents = 'none';
              revertBtn.style.background = '#6b7280';
            }
            
            // Clear test results
            cardElement.querySelectorAll('.test-result').forEach(r => r.remove());
          }
        }
      });
      
      // Show success toast
      if (revertedCount > 0) {
        showToast(`↩️ Reverted ${revertedCount} elements to original text!`, 'success');
      } else {
        showToast('No elements to revert', 'error');
      }
    }
  });
  
  panel.querySelector('#export-all-btn')?.addEventListener('click', () => {
    exportAllResults(issues);
  });
  
  panel.querySelector('#clear-all-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all cards? Elements will be reverted to original text.')) {
      // Use the same logic as Revert All button
      const content = panel.querySelector('[data-content-area]') as HTMLElement;
      if (content) {
        // Get all cards before removing
        const allCards = content.querySelectorAll('[data-issue-card], [data-manual-card]');
        
        // Revert each element properly
        allCards.forEach((card) => {
          const cardElement = card as HTMLElement;
          
          // Check if it's a manual card or issue card
          if (cardElement.hasAttribute('data-manual-card')) {
            const elementId = cardElement.dataset.elementId;
            if (elementId) {
              // Remove from tracked elements
              manuallyAddedElements.delete(elementId);
              
              // Revert element and remove ALL tracking
              const element = document.querySelector(`[data-overflow-scout-id="${elementId}"]`) as HTMLElement;
              if (element) {
                if (element.dataset.overflowScoutOriginal) {
                  element.textContent = element.dataset.overflowScoutOriginal;
                }
                delete element.dataset.overflowScoutOriginal;
                delete element.dataset.overflowScoutTested;
                delete element.dataset.overflowScoutManual;
                delete element.dataset.overflowScoutId;
              }
            }
          } else if (cardElement.hasAttribute('data-issue-card')) {
            // Revert auto-scan issue
            const issue = (cardElement as any).__overflowScoutIssue;
            if (issue?.element) {
              if (issue.element.dataset.overflowScoutOriginal) {
                issue.element.textContent = issue.element.dataset.overflowScoutOriginal;
              }
              delete issue.element.dataset.overflowScoutOriginal;
              delete issue.element.dataset.overflowScoutTested;
              delete issue.element.dataset.overflowScoutId;
            }
          }
        });
        
        // Remove all cards
        content.innerHTML = '';
        
        // Show empty state
        const emptyState = document.createElement('div');
        emptyState.setAttribute('data-empty-state', 'true');
        emptyState.style.cssText = `
          padding: 48px 24px;
          text-align: center;
          color: #10b981;
        `;
        emptyState.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 12px;">✨</div>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">
            All Clear!
          </div>
          <div style="font-size: 13px; color: #6b7280;">
            All elements reverted. Click "Scan" to find issues or add elements manually.
          </div>
        `;
        
        content.appendChild(emptyState);
        
        // Clear preset index
        elementPresetIndex.clear();
        
        // Update toggle tab
        const tab = document.getElementById('overflow-scout-toggle-tab');
        if (tab) {
          updateToggleTabContent(tab, false);
        }
        
        // Show success toast
        showToast('✨ All elements reverted and cleared!', 'success');
      }
    }
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
  
  // Hide tab when panel is open (redundant but explicit)
  tab.style.display = 'none';
}

/**
 * Update toggle tab content with current count (includes manual + auto-scan)
 */
function updateToggleTabContent(tab: HTMLElement, shouldShow: boolean = false): void {
  // Count cards in the panel (not elements on page)
  const panel = document.getElementById('overflow-scout-results-panel');
  let totalCount = 0;
  
  if (panel) {
    const issueCards = panel.querySelectorAll('[data-issue-card]');
    const manualCards = panel.querySelectorAll('[data-manual-card]');
    totalCount = issueCards.length + manualCards.length;
  } else {
    // If panel is closed, count tracked elements
    const manualElements = document.querySelectorAll('[data-overflow-scout-manual="true"]');
    const autoScanElements = document.querySelectorAll('[data-overflow-scout-id]');
    
    const allElements = new Set<Element>();
    manualElements.forEach(el => allElements.add(el));
    autoScanElements.forEach(el => allElements.add(el));
    
    totalCount = allElements.size;
  }
  
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
      ${totalCount > 0 ? `<span style="
        background: rgba(255, 255, 255, 0.3);
        border-radius: 12px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 700;
        min-width: 20px;
        text-align: center;
        writing-mode: horizontal-tb;
      ">${totalCount}</span>` : ''}
    </div>
  `;
  
  // Show/hide based on count AND panel state
  const isPanelOpen = panel && panel.getAttribute('data-panel-open') === 'true';
  
  if ((totalCount > 0 || shouldShow) && !isPanelOpen) {
    // Only show tab if panel is NOT open
    tab.style.display = 'block';
  } else {
    tab.style.display = 'none';
  }
  
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
    // Update the tab content with current count
    updateToggleTabContent(tab, false);
    
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
  card.setAttribute('data-issue-card', 'true');
  card.className = `os-card os-card-severity-${issue.severity}`;
  
  card.innerHTML = `
    <div class="os-card-header">
      <div class="os-card-title">
        <span>#${index + 1}</span>
        <span class="os-selector-text">${issue.selector}</span>
        <button class="os-button os-btn-copy copy-selector-btn" title="Copy selector">📋</button>
      </div>
      <div class="os-severity-badge os-severity-${issue.severity}">${issue.severity}</div>
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
          color: #374151;
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
        <button class="preset-btn-${index} os-preset-btn" data-preset-type="longName">Long Name</button>
        <button class="preset-btn-${index} os-preset-btn" data-preset-type="product">Product</button>
        <button class="preset-btn-${index} os-preset-btn" data-preset-type="url">URL</button>
        <button class="preset-btn-${index} os-preset-btn" data-preset-type="email">Email</button>
        <button class="preset-btn-${index} os-preset-btn" data-preset-type="longText">Long Text</button>
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
      <button class="screenshot-btn" style="
        background: #8b5cf6;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        flex: 1;
      ">📸 Capture</button>
      <button class="jump-btn" style="
        background: #10b981;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        flex: 1;
      ">Jump</button>
      <button class="remove-card-btn" style="
        background: #ef4444;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        flex: 1;
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
    revertElement(card, issue.element.dataset.overflowScoutId || '');
  });
  
  // Jump to element handler
  card.querySelector('.jump-btn')?.addEventListener('click', () => {
    highlightAndJumpToElement(issue.element);
  });
  
  // Remove card handler
  card.querySelector('.remove-card-btn')?.addEventListener('click', () => {
    removeCard(card, issue);
  });
  
  // Screenshot handler
  card.querySelector('.screenshot-btn')?.addEventListener('click', async () => {
    await captureElementScreenshot(issue.element, {
      selector: issue.selector,
      testText: issue.element.textContent?.substring(0, 40) || '',
      severity: issue.severity
    });
  });
  
  // Copy selector button
  card.querySelector('.copy-selector-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(issue.selector);
      showToast('📋 Selector copied!', 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast('❌ Copy failed', 'error');
    }
  });
  
  // Store element reference and issue on card for batch operations
  (card as any).__overflowScoutElement = issue.element;
  (card as any).__overflowScoutIssue = issue;
  
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
function revertElement(card: HTMLElement, elementId: string): void {
  // Try to find element - could be from auto-scan or manual
  const element = document.querySelector(`[data-overflow-scout-id="${elementId}"]`) as HTMLElement;
  
  // Also check if this is an auto-scan card with stored issue
  const issue = (card as any).__overflowScoutIssue;
  const targetElement = element || issue?.element;
  
  if (targetElement && targetElement.dataset.overflowScoutOriginal) {
    // Revert to original text
    targetElement.textContent = targetElement.dataset.overflowScoutOriginal;
    
    // Reset textarea to show original text
    const textarea = card.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = targetElement.dataset.overflowScoutOriginal;
      textarea.placeholder = 'Original text restored';
    }
    
    // Update button state
    const revertBtn = card.querySelector('.revert-btn, .revert-btn-manual') as HTMLButtonElement;
    if (revertBtn) {
      revertBtn.disabled = true;
      revertBtn.style.opacity = '0.5';
      revertBtn.style.pointerEvents = 'none';
      revertBtn.style.background = '#6b7280';
    }
  }
  
  // Clear test results
  card.querySelectorAll('.test-result').forEach(r => r.remove());
  
  // Show success message
  const message = document.createElement('div');
  message.style.cssText = `
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 4px;
    padding: 8px;
    margin-top: 8px;
    font-size: 11px;
    font-weight: 600;
  `;
  message.style.color = '#16a34a'; // Set inline color separately to preserve it
  message.textContent = '✅ Reverted to original text';
  message.className = 'test-result';
  card.appendChild(message);
  
  setTimeout(() => {
    message.style.transition = 'opacity 0.3s';
    message.style.opacity = '0';
    setTimeout(() => message.remove(), 300);
  }, 2000);
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
 * Capture screenshot of element with visual indicator
 */
async function captureElementScreenshot(
  element: HTMLElement, 
  metadata: { selector: string; testText: string; severity: string }
): Promise<void> {
  try {
    // Scroll element into view (use auto for instant scroll)
    element.scrollIntoView({ behavior: 'auto', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create visual indicator overlay
    const indicator = document.createElement('div');
    indicator.id = 'overflow-scout-screenshot-indicator';
    indicator.style.cssText = `
      position: absolute;
      border: 4px solid #dc2626;
      background: rgba(220, 38, 38, 0.1);
      pointer-events: none;
      z-index: 2147483645;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
      transition: all 0.2s;
    `;
    
    const rect = element.getBoundingClientRect();
    indicator.style.top = `${rect.top + window.scrollY}px`;
    indicator.style.left = `${rect.left + window.scrollX}px`;
    indicator.style.width = `${rect.width}px`;
    indicator.style.height = `${rect.height}px`;
    
    // Add label
    const label = document.createElement('div');
    label.style.cssText = `
      position: absolute;
      top: -32px;
      left: 0;
      background: #dc2626;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    label.textContent = `⚠️ Overflow Issue`;
    indicator.appendChild(label);
    
    document.body.appendChild(indicator);
    
    // Wait for render and any animations to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Capture screenshot using Chrome API
    chrome.runtime.sendMessage(
      { type: 'CAPTURE_SCREENSHOT' },
      async (response) => {
        if (response?.dataUrl) {
          // Remove indicator
          indicator.remove();
          
          // Show action menu
          await showScreenshotActionMenu(response.dataUrl, metadata);
        } else {
          indicator.remove();
          showToast('❌ Screenshot failed. Please try again.', 'error');
        }
      }
    );
    
  } catch (error) {
    console.error('Screenshot error:', error);
    showToast('❌ Screenshot failed. Please try again.', 'error');
  }
}

/**
 * Show action menu for screenshot
 */
async function showScreenshotActionMenu(
  dataUrl: string,
  metadata: { selector: string; testText: string; severity: string }
): Promise<void> {
  // Save interactive mode state and temporarily disable it
  const wasInteractiveModeActive = document.body.classList.contains('overflow-scout-interactive-cursor');
  if (wasInteractiveModeActive) {
    window.postMessage({ type: 'OVERFLOW_SCOUT_TOGGLE_INTERACTIVE' }, '*');
  }
  
  const menu = document.createElement('div');
  menu.setAttribute('data-screenshot-modal', 'true');
  menu.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    min-width: 320px;
  `;
  
  menu.innerHTML = `
    <div style="margin-bottom: 16px;">
      <div style="font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 8px;">
        📸 Screenshot Captured
      </div>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 12px;">
        Element: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${metadata.selector}</code>
      </div>
      <img src="${dataUrl}" style="width: 100%; border-radius: 6px; border: 1px solid #e5e7eb;">
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <button id="copy-screenshot" style="
        background: #3b82f6;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      ">
        📋 Copy to Clipboard
      </button>
      <button id="download-screenshot" style="
        background: #8b5cf6;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      ">
        💾 Download PNG
      </button>
      <button id="close-screenshot-menu" style="
        background: transparent;
        color: #6b7280;
        border: 1px solid #e5e7eb;
        padding: 10px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      ">
        Cancel
      </button>
    </div>
  `;
  
  document.body.appendChild(menu);
  
  // Helper to restore interactive mode when modal closes
  const closeModal = () => {
    menu.remove();
    // Restore interactive mode if it was active before
    if (wasInteractiveModeActive) {
      setTimeout(() => {
        window.postMessage({ type: 'OVERFLOW_SCOUT_TOGGLE_INTERACTIVE' }, '*');
      }, 100);
    }
  };
  
  // Copy to clipboard handler
  menu.querySelector('#copy-screenshot')?.addEventListener('click', async () => {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showToast('✅ Screenshot copied to clipboard!', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      showToast('❌ Copy failed. Try download instead.', 'error');
    }
  });
  
  // Download handler
  menu.querySelector('#download-screenshot')?.addEventListener('click', () => {
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `overflow-issue-${timestamp}.png`;
    link.href = dataUrl;
    link.click();
    showToast('✅ Screenshot downloaded!', 'success');
  });
  
  // Close handler
  menu.querySelector('#close-screenshot-menu')?.addEventListener('click', closeModal);
}

/**
 * Generate unique ID for an element based on its position in the DOM
 */
function generateElementId(element: HTMLElement): string {
  const tagName = element.tagName.toLowerCase();
  const className = element.className || 'no-class';
  const textContent = (element.textContent || '').substring(0, 20);
  
  // Try to find a unique identifier
  let path = tagName;
  let current: HTMLElement | null = element;
  let depth = 0;
  
  while (current && current.parentElement && depth < 5) {
    const parent: HTMLElement = current.parentElement;
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(current);
    path = `${parent.tagName.toLowerCase()}[${index}]/${path}`;
    current = parent;
    depth++;
  }
  
  return `${path}-${className}-${textContent}`;
}

/**
 * Update existing results panel with new issues (no animation)
 */
export function updateResultsPanel(issues: OverflowIssue[]): void {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  
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
    
    // Get existing element IDs from manual cards to avoid duplicates
    const existingElements = new Set<string>();
    content.querySelectorAll('[data-manual-card]').forEach(card => {
      const elementId = (card as HTMLElement).dataset.elementId;
      if (elementId) {
        existingElements.add(elementId);
      }
    });
    
    // Add new auto-scan results after manual cards (skip duplicates)
    const manualCards = content.querySelectorAll('[data-manual-card]');
    const insertPosition = manualCards.length > 0 
      ? (manualCards[manualCards.length - 1] as HTMLElement).nextSibling 
      : content.firstChild;
    
    issues.forEach((issue, index) => {
      // Generate element ID for comparison
      const elementId = generateElementId(issue.element);
      
      // Skip if this element already exists as a manual card
      if (existingElements.has(elementId)) {
        return;
      }
      
      const card = createIssueCard(issue, index + manuallyAddedElements.size);
      card.setAttribute('data-issue-card', 'true');
      if (insertPosition) {
        content.insertBefore(card, insertPosition);
      } else {
        content.appendChild(card);
      }
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
}

/**
 * Check if panel is open
 */
export function isPanelOpen(): boolean {
  const panel = document.getElementById(PANEL_ID);
  return panel !== null && panel.getAttribute('data-panel-open') === 'true';
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

/**
 * Test all elements with random long text
 */
function testAllElements(panel: HTMLElement): void {
  const content = panel.querySelector('[data-content-area]') as HTMLElement;
  if (!content) return;
  
  const cards = content.querySelectorAll('[data-issue-card], [data-manual-card]');
  const totalCards = cards.length;
  
  if (totalCards === 0) {
    showToast('❌ No elements found to test', 'error');
    return;
  }
  
  let tested = 0;
  
  cards.forEach((card, index) => {
    setTimeout(() => {
      // Always use longText for "Test All" to stress test properly
      const randomText = PRESET_POOLS.longText[Math.floor(Math.random() * PRESET_POOLS.longText.length)];
      
      const textarea = card.querySelector('textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = randomText;
        autoExpandTextarea(textarea);
      }
      
      const isManualCard = card.hasAttribute('data-manual-card');
      
      if (isManualCard) {
        const elementId = (card as HTMLElement).dataset.elementId;
        const element = document.querySelector(`[data-overflow-scout-id="${elementId}"]`) as HTMLElement;
        
        // Skip if element is inside the extension panel
        if (element && !element.closest('#overflow-scout-results-panel')) {
          testElementWithCustomText(element, randomText, card as HTMLElement);
          tested++;
        }
      } else {
        const issueElement = (card as any).__overflowScoutElement;
        
        // Skip if element is inside the extension panel
        if (issueElement && !issueElement.closest('#overflow-scout-results-panel')) {
          testElementWithCustomText(issueElement, randomText, card as HTMLElement);
          tested++;
        }
      }
      
      // Show toast after the last card is processed
      if (index === cards.length - 1) {
        setTimeout(() => {
          showToast(`✅ Tested ${totalCards} elements with random text!`, 'success');
        }, 200);
      }
    }, index * 150);
  });
}


/**
 * Export all results as JSON
 */
function exportAllResults(issues: OverflowIssue[]): void {
  const exportData = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    totalIssues: issues.length + manuallyAddedElements.size,
    autoScanIssues: issues.map(issue => ({
      selector: issue.selector,
      severity: issue.severity,
      originalText: issue.originalText,
      testText: issue.testText,
      cssIssues: issue.cssIssues,
      suggestedFixes: issue.suggestedFixes
    })),
    manualElements: Array.from(manuallyAddedElements.values()).map(el => ({
      selector: el.selector,
      elementId: el.elementId,
      originalText: el.originalText
    }))
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  link.download = `overflow-scout-results-${timestamp}.json`;
  link.href = url;
  link.click();
  
  showToast('📦 Results exported!', 'success');
}

/**
 * Show toast notification
 */
function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    animation: slideInUp 0.3s ease-out;
  `;
  toast.textContent = message;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInUp {
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
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transition = 'all 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
