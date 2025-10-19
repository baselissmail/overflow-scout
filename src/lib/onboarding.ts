/**
 * Onboarding tooltip system
 * Shows a quick guide on first use
 */

const ONBOARDING_KEY = 'overflow-scout-onboarding-completed';

export function shouldShowOnboarding(): boolean {
  return !localStorage.getItem(ONBOARDING_KEY);
}

export function markOnboardingComplete(): void {
  localStorage.setItem(ONBOARDING_KEY, 'true');
}

export function resetOnboarding(): void {
  localStorage.removeItem(ONBOARDING_KEY);
}

export function showOnboardingTooltip(): void {
  if (!shouldShowOnboarding()) {
    console.log('[Overflow Scout] Onboarding already completed');
    return;
  }

  // Remove any existing onboarding tooltips
  const existing = document.getElementById('overflow-scout-onboarding');
  if (existing) existing.remove();

  console.log('[Overflow Scout] Showing onboarding modal');

  const tooltip = document.createElement('div');
  tooltip.id = 'overflow-scout-onboarding';
  tooltip.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    color: white;
    padding: 32px 40px;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    max-width: 480px;
    animation: onboardingFadeIn 0.4s ease-out;
  `;

  tooltip.innerHTML = `
    <style>
      @keyframes onboardingFadeIn {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }
    </style>
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 48px; margin-bottom: 12px;">👋</div>
      <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">
        Welcome to Overflow Scout!
      </div>
      <div style="font-size: 14px; opacity: 0.95; line-height: 1.6;">
        Find and fix text overflow issues in seconds
      </div>
    </div>
    
    <div style="background: rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <div style="font-size: 15px; font-weight: 600; margin-bottom: 16px; text-align: center;">
        Quick Start Guide
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
        <div style="display: flex; gap: 12px; align-items: start;">
          <div style="flex-shrink: 0; width: 28px; height: 28px; background: rgba(255,255,255,0.2); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 700;">1</div>
          <div style="flex: 1; padding-top: 4px;">
            Click <strong>🔄 Scan</strong> to detect overflow issues
          </div>
        </div>
        <div style="display: flex; gap: 12px; align-items: start;">
          <div style="flex-shrink: 0; width: 28px; height: 28px; background: rgba(255,255,255,0.2); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 700;">2</div>
          <div style="flex: 1; padding-top: 4px;">
            Or click <strong>👆 Start</strong> for interactive mode (point & click)
          </div>
        </div>
        <div style="display: flex; gap: 12px; align-items: start;">
          <div style="flex-shrink: 0; width: 28px; height: 28px; background: rgba(255,255,255,0.2); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 700;">3</div>
          <div style="flex: 1; padding-top: 4px;">
            Use <strong>📸 Capture</strong> to screenshot issues
          </div>
        </div>
      </div>
    </div>
    
    <div style="background: rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; line-height: 1.5;">
      <strong>⌨️ Keyboard Shortcuts:</strong><br>
      <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 3px; margin: 4px 4px 4px 0; display: inline-block;">Ctrl+Shift+O</code> Scan page<br>
      <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 3px; margin: 4px 4px 4px 0; display: inline-block;">Esc</code> Close panel
    </div>
    
    <button id="onboarding-got-it" style="
      width: 100%;
      background: white;
      color: #3b82f6;
      border: none;
      padding: 14px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    " onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">
      Got it! Let's start
    </button>
  `;

  document.body.appendChild(tooltip);

  // Handle button click
  tooltip.querySelector('#onboarding-got-it')?.addEventListener('click', () => {
    tooltip.style.animation = 'onboardingFadeOut 0.3s ease-out';
    setTimeout(() => {
      tooltip.remove();
      markOnboardingComplete();
    }, 300);
  });

  // Add fade out animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes onboardingFadeOut {
      from {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
      to {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.95);
      }
    }
  `;
  document.head.appendChild(style);
}
