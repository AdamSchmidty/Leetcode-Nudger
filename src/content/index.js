// ============================================================================
// LEETCODE BUDDY - CONTENT SCRIPT (Main Entry Point)
// ============================================================================
// Monitors LeetCode problem pages for successful submissions
// Orchestrates detection, verification, and celebration modules
// ============================================================================

console.log("Leetcode Buddy - Content Script Loading");

// State
let lastPathname = window.location.pathname;
let checkTimeout = null;
let hasCheckedOnLoad = false;

// Store imported functions
let checkAndNotify = null;
let shouldSkipSolveCheck = null;

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
      checkTimeout = setTimeout(async () => {
        if (checkAndNotify && shouldSkipSolveCheck) {
          // Check guard before calling
          const skip = await shouldSkipSolveCheck();
          if (!skip) {
            checkAndNotify();
          }
        } else if (checkAndNotify) {
          // Fallback if guard not yet loaded
          checkAndNotify();
        }
      }, 2000);

      break;
    }
  }
});

// Initialize with error boundaries
(async function initializeLeetcodeBuddy() {
  try {
    console.log("🤝 Leetcode Buddy initializing...");
    
    // Use dynamic imports - files must be in web_accessible_resources
    // Chrome extensions support dynamic imports for ES modules in content scripts
    const apiModule = await import(chrome.runtime.getURL('src/content/api.js'));
    const detectorModule = await import(chrome.runtime.getURL('src/content/detector.js'));
    const editorModule = await import(chrome.runtime.getURL('src/content/editor.js'));
    
    // Extract functions
    const { loadAliases, getCurrentSlug } = apiModule;
    checkAndNotify = detectorModule.checkAndNotify;
    shouldSkipSolveCheck = detectorModule.shouldSkipSolveCheck;
    const { clearEditor } = editorModule;
    
    // Load problem aliases
    await loadAliases();
    
    // Function to handle editor clearing on first open
    async function handleEditorClearing() {
      try {
        // Check if setting is enabled
        const syncResult = await chrome.storage.sync.get(['clearEditorOnFirstOpen']);
        const isEnabled = syncResult.clearEditorOnFirstOpen === true;
        
        if (!isEnabled) {
          return; // Setting disabled, skip
        }
        
        // Get current problem slug
        const slug = getCurrentSlug();
        if (!slug) {
          return; // Not on a problem page
        }
        
        // Check if this is the first open today
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        const key = `problemFirstOpened_${slug}`;
        const localResult = await chrome.storage.local.get([key]);
        const storedDate = localResult[key];
        
        const isFirstOpen = storedDate !== today;
        
        if (isFirstOpen) {
          console.log(`First time opening ${slug} today, clearing editor...`);
          
          // Mark as opened immediately to prevent multiple attempts
          await chrome.storage.local.set({ [key]: today });
          
          // Clear the editor (with delay to ensure editor is loaded)
          setTimeout(async () => {
            const cleared = await clearEditor();
            if (cleared) {
              console.log(`Editor cleared successfully for ${slug}`);
            } else {
              console.warn(`Editor clearing failed for ${slug}, but problem marked as opened`);
            }
          }, 2000); // Wait 2 seconds for editor to initialize
        } else {
          console.log(`Problem ${slug} already opened today, preserving editor content`);
        }
      } catch (error) {
        console.error("Error in editor clearing handler:", error);
      }
    }
    
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

          // Handle editor clearing on problem change
          handleEditorClearing();

          // Check after a delay to let the page load
          setTimeout(async () => {
            if (!hasCheckedOnLoad && checkAndNotify) {
              if (shouldSkipSolveCheck) {
                const skip = await shouldSkipSolveCheck();
                if (!skip) {
                  checkAndNotify();
                  hasCheckedOnLoad = true;
                }
              } else {
                // Fallback if guard not yet loaded
                checkAndNotify();
                hasCheckedOnLoad = true;
              }
            }
          }, 3000);
        }
      } catch (error) {
        console.error("Error in URL change handler:", error);
      }
    }, 1000);

    // Initial check when content script loads
    setTimeout(async () => {
      try {
        // Handle editor clearing on initial load
        handleEditorClearing();
        
        if (!hasCheckedOnLoad && checkAndNotify) {
          if (shouldSkipSolveCheck) {
            const skip = await shouldSkipSolveCheck();
            if (!skip) {
              console.log("Initial problem status check...");
              checkAndNotify();
              hasCheckedOnLoad = true;
            }
          } else {
            // Fallback if guard not yet loaded
            console.log("Initial problem status check...");
            checkAndNotify();
            hasCheckedOnLoad = true;
          }
        }
      } catch (error) {
        console.error("Error in initial check:", error);
      }
    }, 3000);

    // Listen for visibility changes (tab becomes active)
    document.addEventListener("visibilitychange", () => {
      try {
        if (!document.hidden && checkAndNotify) {
          setTimeout(async () => {
            if (shouldSkipSolveCheck) {
              const skip = await shouldSkipSolveCheck();
              if (!skip) {
                console.log("Tab became visible, checking status...");
                checkAndNotify();
              }
            } else {
              // Fallback if guard not yet loaded
              console.log("Tab became visible, checking status...");
              checkAndNotify();
            }
          }, 1000);
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

