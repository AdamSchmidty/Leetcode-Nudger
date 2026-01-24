// ============================================================================
// LEETCODE BUDDY - CONTENT UI MODULE
// ============================================================================
// Handles celebrations, confetti animations, and user notifications
// ============================================================================

/**
 * Check if celebration should be shown (only once per day and if enabled)
 * @returns {Promise<boolean>} True if celebration should be shown
 */
export async function checkIfShouldShowCelebration() {
  try {
    // Check if celebrations are enabled in settings (default: true)
    const syncResult = await chrome.storage.sync.get(['celebrationEnabled']);
    const isEnabled = syncResult.celebrationEnabled !== false;
    
    if (!isEnabled) {
      console.log("Celebrations are disabled in settings");
      return false;
    }
    
    // Check if celebration has already been shown today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const localResult = await chrome.storage.local.get(['celebrationShownDate']);
    
    // Show celebration if it hasn't been shown today and is enabled
    return localResult.celebrationShownDate !== today;
  } catch (error) {
    console.error("Failed to check celebration status:", error);
    return true; // Show on error to be safe
  }
}

/**
 * Mark celebration as shown for today
 * @returns {Promise<void>}
 */
export async function markCelebrationAsShown() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    await chrome.storage.local.set({ celebrationShownDate: today });
    console.log("Celebration marked as shown for:", today);
  } catch (error) {
    console.error("Failed to mark celebration as shown:", error);
  }
}

/**
 * Trigger confetti animation (CSS-based, no external dependencies)
 */
export function triggerConfetti() {
  const confettiContainer = document.createElement('div');
  confettiContainer.id = 'leetcode-buddy-confetti';
  confettiContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10000;
    overflow: hidden;
  `;
  
  // Create confetti pieces
  const colors = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6'];
  const shapes = ['circle', 'square', 'triangle'];
  const confettiCount = 60;
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const left = Math.random() * 100;
    const animationDelay = Math.random() * 0.5;
    const animationDuration = 2.5 + Math.random() * 2;
    const size = 8 + Math.random() * 6;
    const rotation = Math.random() * 360;
    
    let shapeStyle = '';
    if (shape === 'circle') {
      shapeStyle = 'border-radius: 50%;';
    } else if (shape === 'triangle') {
      shapeStyle = `
        width: 0;
        height: 0;
        border-left: ${size/2}px solid transparent;
        border-right: ${size/2}px solid transparent;
        border-bottom: ${size}px solid ${color};
        background: transparent;
      `;
    }
    
    confetti.style.cssText = `
      position: absolute;
      left: ${left}%;
      top: -20px;
      width: ${shape === 'triangle' ? '0' : size + 'px'};
      height: ${shape === 'triangle' ? '0' : size + 'px'};
      background: ${shape === 'triangle' ? 'transparent' : color};
      ${shapeStyle}
      opacity: 0.9;
      animation: confettiFall ${animationDuration}s linear ${animationDelay}s forwards;
      transform: rotate(${rotation}deg);
      transform-origin: center;
    `;
    
    confettiContainer.appendChild(confetti);
  }
  
  // Add animation styles if not already added
  if (!document.getElementById('confetti-animation-styles')) {
    const style = document.createElement('style');
    style.id = 'confetti-animation-styles';
    style.textContent = `
      @keyframes confettiFall {
        0% {
          transform: translateY(0) rotateZ(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) rotateZ(720deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(confettiContainer);
  
  // Remove after animation
  setTimeout(() => {
    confettiContainer.remove();
  }, 5000);
}

/**
 * Show a celebration notification when problem is solved
 * @returns {Promise<void>}
 */
export async function showSolvedNotification() {
  // Check if celebration should be shown
  const shouldShowCelebration = await checkIfShouldShowCelebration();
  
  if (shouldShowCelebration) {
    // Trigger confetti celebration!
    triggerConfetti();
    await markCelebrationAsShown();
  }
  
  // Always show the notification
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 20px 24px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 10002;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 16px;
    font-weight: 600;
    max-width: 350px;
    animation: slideIn 0.5s ease-out;
  `;
  notification.innerHTML = `
    <div style="margin-bottom: 8px; font-size: 32px; animation: bounce 0.6s ease-in-out;">🎉</div>
    <div style="font-size: 18px; margin-bottom: 4px;">Amazing! Daily Problem Solved!</div>
    <div style="font-size: 14px; font-weight: 400; opacity: 0.95; margin-top: 6px;">
      All websites unblocked until midnight. Great work! 🎊
    </div>
  `;

  // Add animations if not already added
  if (!document.getElementById('notification-animation-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-animation-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes bounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.3); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);

  // Remove notification after 6 seconds
  setTimeout(() => {
    notification.style.transition = "opacity 0.5s, transform 0.5s";
    notification.style.opacity = "0";
    notification.style.transform = "translateX(400px)";
    
    setTimeout(() => {
      notification.remove();
    }, 500);
  }, 6000);
}

