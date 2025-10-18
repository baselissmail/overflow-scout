/**
 * Phase 5: Session Banner
 * Visual indicator for active test mode
 */

const BANNER_ID = 'overflow-scout-session-banner';

export interface BannerOptions {
  totalTested: number;
  totalBroken: number;
  onRevertAll?: () => void;
}

/**
 * Create session banner to indicate test mode is active
 */
export function createSessionBanner(options: BannerOptions): void {
  // Remove existing banner
  removeSessionBanner();

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
    color: white;
    padding: 12px 24px;
    border-radius: 0 0 12px 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 16px;
    pointer-events: auto;
    animation: slideDown 0.3s ease;
  `;

  const statusText = document.createElement('div');
  statusText.style.cssText = 'display: flex; align-items: center; gap: 12px;';
  
  const icon = document.createElement('span');
  icon.textContent = '🔍';
  icon.style.fontSize = '18px';

  const text = document.createElement('span');
  text.innerHTML = `
    <strong>Overflow Scout Active</strong> • 
    <span style="color: #60a5fa;">${options.totalTested} tested</span> • 
    <span style="color: ${options.totalBroken > 0 ? '#f87171' : '#4ade80'};">
      ${options.totalBroken} broken
    </span>
  `;

  statusText.appendChild(icon);
  statusText.appendChild(text);

  // Revert All button
  const revertBtn = document.createElement('button');
  revertBtn.textContent = 'Revert All';
  revertBtn.style.cssText = `
    background: #dc2626;
    color: white;
    border: none;
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    transition: background 0.2s;
  `;
  
  revertBtn.onmouseover = () => {
    revertBtn.style.background = '#b91c1c';
  };
  
  revertBtn.onmouseout = () => {
    revertBtn.style.background = '#dc2626';
  };

  revertBtn.onclick = () => {
    if (options.onRevertAll) {
      options.onRevertAll();
    }
  };

  banner.appendChild(statusText);
  banner.appendChild(revertBtn);

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from {
        transform: translateX(-50%) translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(banner);
}

/**
 * Update session banner with new stats
 */
export function updateSessionBanner(options: BannerOptions): void {
  const banner = document.getElementById(BANNER_ID);
  
  if (!banner) {
    createSessionBanner(options);
    return;
  }

  const text = banner.querySelector('span:nth-child(2)');
  if (text) {
    text.innerHTML = `
      <strong>Overflow Scout Active</strong> • 
      <span style="color: #60a5fa;">${options.totalTested} tested</span> • 
      <span style="color: ${options.totalBroken > 0 ? '#f87171' : '#4ade80'};">
        ${options.totalBroken} broken
      </span>
    `;
  }
}

/**
 * Remove session banner
 */
export function removeSessionBanner(): void {
  const banner = document.getElementById(BANNER_ID);
  if (banner) {
    banner.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => banner.remove(), 300);
  }
}

/**
 * Check if banner exists
 */
export function hasBanner(): boolean {
  return document.getElementById(BANNER_ID) !== null;
}
