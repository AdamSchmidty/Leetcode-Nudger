// ============================================================================
// LEETCODE BUDDY - CONTENT SCRIPT (Main Entry Point)
// ============================================================================
// Monitors LeetCode problem pages for successful submissions
// Orchestrates detection, verification, and celebration modules
// ============================================================================

import { loadAliases } from './api.js';
import { checkAndNotify } from './detector.js';

console.log("Leetcode Buddy - Content Script Loading");

// State
let lastPathname = window.location.pathname;
let checkTimeout = null;
let hasCheckedOnLoad = false;

// Watch for DOM changes that indicate a submission result
const observer = new MutationObserver((mutations) => {
  // Look for success indicators in the DOM
  const successElements = document.querySelectorAll(
    '[data-e2e-locator="submission-result"]'
  );

  for (const element of successElements) {
    const text = element.textContent || "";
    if (text.includes("Accepted") || text.includes("Success")) {
      console.log("Detected successful submission!");

      // Clear any pending check
      if (checkTimeout) {
        clearTimeout(checkTimeout);
      }

      // Check status after a short delay to let LeetCode update the backend
      checkTimeout = setTimeout(() => {
        checkAndNotify();
      }, 2000);

      break;
    }
  }
});

// Initialize with error boundaries
(async function initializeLeetcodeBuddy() {
  try {
    console.log("🤝 Leetcode Buddy initializing...");
    
    // Load problem aliases
    await loadAliases();
    
    // Start observing the document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Check periodically if URL changed (client-side navigation)
    setInterval(() => {
      try {
        if (window.location.pathname !== lastPathname) {
          console.log("URL changed, checking new problem...");
          lastPathname = window.location.pathname;
          hasCheckedOnLoad = false;

          // Check after a delay to let the page load
          setTimeout(() => {
            if (!hasCheckedOnLoad) {
              checkAndNotify();
              hasCheckedOnLoad = true;
            }
          }, 3000);
        }
      } catch (error) {
        console.error("Error in URL change handler:", error);
      }
    }, 1000);

    // Initial check when content script loads
    setTimeout(() => {
      try {
        if (!hasCheckedOnLoad) {
          console.log("Initial problem status check...");
          checkAndNotify();
          hasCheckedOnLoad = true;
        }
      } catch (error) {
        console.error("Error in initial check:", error);
      }
    }, 3000);

    // Listen for visibility changes (tab becomes active)
    document.addEventListener("visibilitychange", () => {
      try {
        if (!document.hidden) {
          console.log("Tab became visible, checking status...");
          setTimeout(checkAndNotify, 1000);
        }
      } catch (error) {
        console.error("Error in visibility change handler:", error);
      }
    });

    console.log("✓ Leetcode Buddy content script ready on:", window.location.href);
    
  } catch (error) {
    console.error("❌ Leetcode Buddy initialization error:", error);
    console.error("Stack trace:", error.stack);
  }
})();

