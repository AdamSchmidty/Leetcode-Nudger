// ============================================================================
// LEETCODE BUDDY - CONTENT DETECTOR MODULE
// ============================================================================
// Core detection logic for checking if problems are solved
// Verifies solve date and communicates with background script
// ============================================================================

import { getCurrentSlug, resolveAlias, queryProblemStatus, getCurrentUsername, queryRecentSubmissions, queryProblemSubmissions, isSolvedToday } from './api.js';
import { showSolvedNotification } from './ui.js';

/**
 * Safe message sending with context validation
 * @param {Object} message - Message object to send to background script
 * @returns {Promise<Object>} Response from background script
 */
export async function sendMessageSafely(message) {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.warn("Extension context invalidated, skipping message");
      return { success: false, error: "Context invalidated" };
    }
    
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (error.message?.includes("Extension context invalidated") || 
        error.message?.includes("message port closed") ||
        error.message?.includes("Extension context")) {
      console.warn("Extension was reloaded, skipping message");
      return { success: false, error: "Context invalidated" };
    }
    console.error("Message sending failed:", error);
    throw error;
  }
}

/**
 * Check if the current problem is solved and notify background
 * Main detection logic that verifies the problem was solved today
 * and is the expected problem in the sequence
 */
export async function checkAndNotify() {
  const slug = getCurrentSlug();
  if (!slug) {
    console.log("No problem slug found in URL");
    return;
  }

  // Resolve alias to canonical slug
  const canonicalSlug = resolveAlias(slug);
  console.log("Checking status for problem:", slug, "->", canonicalSlug);

  const status = await queryProblemStatus(canonicalSlug);
  console.log("Problem status:", status);

  if (status === "ac") {
    console.log("Problem is solved! Verifying solve date...");
    
    // Verify the problem was solved TODAY
    let solvedToday = false;
    let solveTimestamp = null;
    
    try {
      // Get username
      const username = await getCurrentUsername();
      
      if (username) {
        console.log("Username:", username);
        
        // First, try to find in recent submissions (faster)
        const recentSubmissions = await queryRecentSubmissions(username, 50);
        console.log(`Found ${recentSubmissions.length} recent submissions`);
        
        // Look for accepted submissions for this problem
        const acceptedSubmissions = recentSubmissions.filter(
          sub => sub.titleSlug === canonicalSlug && sub.statusDisplay === "Accepted"
        );
        
        if (acceptedSubmissions.length > 0) {
          // Check if any submission is from today
          const todaySubmission = acceptedSubmissions.find(sub => isSolvedToday(sub.timestamp));
          if (todaySubmission) {
            solvedToday = true;
            solveTimestamp = todaySubmission.timestamp;
            console.log("✓ Found submission from today in recent submissions");
          }
        }
        
        // Fallback: If not in recent submissions, check problem-specific submission history
        if (!solvedToday) {
          console.log("Not in recent submissions, checking problem-specific history...");
          const problemSubmissions = await queryProblemSubmissions(canonicalSlug, 10);
          
          const todaySubmission = problemSubmissions.find(
            sub => sub.statusDisplay === "Accepted" && isSolvedToday(sub.timestamp)
          );
          
          if (todaySubmission) {
            solvedToday = true;
            solveTimestamp = todaySubmission.timestamp;
            console.log("✓ Found submission from today in problem history");
          }
        }
      } else {
        console.warn("Could not get username, falling back to status-only check");
        // Fallback: If we can't get username, assume solved today
        solvedToday = true;
      }
    } catch (error) {
      console.error("Error verifying solve date:", error);
      // Fallback: On error, assume solved today to not block functionality
      solvedToday = true;
    }
    
    if (solvedToday) {
      console.log("✓ Problem was solved TODAY! Checking if this is the expected problem...");
      
      // Get the current expected problem from background
      const statusResponse = await sendMessageSafely({ type: "GET_STATUS" });
      
      if (!statusResponse.success) {
        console.warn("Could not get current status, skipping daily solve check");
        return;
      }
      
      const expectedProblemSlug = statusResponse.currentProblem?.slug;
      
      if (canonicalSlug !== expectedProblemSlug) {
        console.log(`ℹ️ Problem solved today, but not the expected problem.`);
        console.log(`  Expected: ${expectedProblemSlug}, Solved: ${canonicalSlug}`);
        console.log("  This won't count as today's daily solve.");
        return;
      }
      
      console.log("✓ This is the EXPECTED problem! Notifying background...");
      
      try {
        const response = await sendMessageSafely({
          type: "PROBLEM_SOLVED",
          slug: canonicalSlug,
          timestamp: solveTimestamp,
          verifiedToday: !!solveTimestamp,
        });
        
        // Check if extension context was invalidated
        if (!response.success && response.error === "Context invalidated") {
          console.log("Extension was reloaded, skipping celebration");
          return;
        }
        
        console.log("Background response:", response);

        if (response.dailySolved) {
          // Show celebration and notification
          await showSolvedNotification();
        }
      } catch (error) {
        console.error("Failed to notify background:", error);
      }
    } else {
      console.log("✗ Problem was solved in the past, not counting as daily solve");
    }
  }
}

