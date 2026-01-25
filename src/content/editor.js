// ============================================================================
// LEETCODE BUDDY - EDITOR MODULE
// ============================================================================
// Handles Monaco editor interactions for clearing editor content
// ============================================================================

/**
 * Find the Monaco editor view-lines container
 * @returns {HTMLElement|null} The view-lines container or null if not found
 */
function findEditorContainer() {
  // Monaco editor displays content in a div with class "view-lines monaco-mouse-cursor-text"
  const container = document.querySelector('.view-lines.monaco-mouse-cursor-text');
  return container;
}

/**
 * Wait for Monaco editor DOM to be available
 * @param {number} maxWaitMs - Maximum time to wait in milliseconds (default: 10000)
 * @param {number} pollIntervalMs - Polling interval in milliseconds (default: 200)
 * @returns {Promise<HTMLElement|null>} Editor container element or null if timeout
 */
export async function waitForEditor(maxWaitMs = 10000, pollIntervalMs = 200) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const container = findEditorContainer();
    if (container) {
      return container;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  return null;
}

/**
 * Clear the Monaco editor content by removing child divs
 * @returns {Promise<boolean>} True if editor was cleared successfully
 */
export async function clearEditor() {
  try {
    // Wait for editor DOM to be available
    const container = await waitForEditor();
    
    if (!container) {
      console.warn("Monaco editor container not found after waiting");
      return false;
    }
    
    // Clear all child divs (view-line elements)
    // Monaco will automatically re-render with empty content
    container.innerHTML = '';
    console.log("✓ Editor cleared successfully");
    return true;
  } catch (error) {
    console.error("Error clearing editor:", error);
    return false;
  }
}

