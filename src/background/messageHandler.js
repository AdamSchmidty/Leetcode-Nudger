// ============================================================================
// LEETCODE BUDDY - MESSAGE HANDLER MODULE
// ============================================================================
// Central message routing and handling for all extension communication
// ============================================================================

import * as problemLogic from './problemLogic.js';
import * as storage from './storage.js';
import * as redirects from './redirects.js';

/**
 * Set up the chrome.runtime.onMessage listener
 * Handles all incoming messages from content scripts, popup, and options pages
 */
export function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep message channel open for async response
  });
  
  console.log("Message listener setup complete");
}

/**
 * Handle incoming messages
 * @param {Object} message - Message object with type and data
 * @param {Object} sender - Sender information
 * @param {Function} sendResponse - Response callback
 * @exports For testing purposes
 */
export async function handleMessage(message, sender, sendResponse) {
  try {
    let response;
    
    switch (message.type) {
      case 'PROBLEM_SOLVED':
        response = await handleProblemSolved(message);
        break;
      case 'GET_STATUS':
        response = await handleGetStatus();
        break;
      case 'GET_DETAILED_PROGRESS':
        response = await handleGetDetailedProgress();
        break;
      case 'ACTIVATE_BYPASS':
        response = await redirects.activateBypass();
        break;
      case 'REFRESH_STATUS':
        response = await handleRefreshStatus();
        break;
      case 'RESET_PROGRESS':
        response = await handleResetProgress();
        break;
      default:
        response = { success: false, error: 'Unknown message type' };
    }
    
    sendResponse(response);
  } catch (error) {
    console.error('Message handling error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle PROBLEM_SOLVED message
 * Validates solve date and marks daily solve if appropriate
 */
async function handleProblemSolved(message) {
  console.log("Problem solved:", message.slug);
  
  // Validate that the problem was solved today
  let shouldMarkDailySolve = true;
  
  if (message.timestamp && message.verifiedToday) {
    // Timestamp provided and verified by content script
    const submissionDate = new Date(parseInt(message.timestamp) * 1000);
    const today = new Date();
    
    // Double-check the date is today (defense in depth)
    const isToday = (
      submissionDate.getFullYear() === today.getFullYear() &&
      submissionDate.getMonth() === today.getMonth() &&
      submissionDate.getDate() === today.getDate()
    );
    
    if (isToday) {
      console.log("✓ Verified: Problem solved today with timestamp:", new Date(parseInt(message.timestamp) * 1000).toLocaleString());
    } else {
      console.log("✗ Timestamp verification failed: Problem was not solved today");
      shouldMarkDailySolve = false;
    }
  } else if (message.verifiedToday === false) {
    // Content script explicitly marked as not solved today
    console.log("✗ Content script verified problem was NOT solved today");
    shouldMarkDailySolve = false;
  } else {
    // No timestamp provided, fallback behavior (allow it)
    console.log("⚠ No timestamp verification, allowing solve (fallback mode)");
  }

  if (shouldMarkDailySolve) {
    // Mark daily solve with problem slug
    await storage.markDailySolve(message.slug);
    
    // Add problem to solved problems list
    const state = await storage.getState();
    const solvedProblems = new Set(state.solvedProblems || []);
    solvedProblems.add(message.slug);
    await chrome.storage.sync.set({
      solvedProblems: Array.from(solvedProblems)
    });
    
    // Remove redirect rule to unblock websites
    await redirects.removeRedirectRule();

    // Recompute next problem for tomorrow
    const nextProblem = await problemLogic.computeNextProblem();

    return {
      success: true,
      nextProblem: nextProblem,
      dailySolved: true,
    };
  } else {
    // Problem was solved in the past, don't mark as daily solve
    console.log("Not marking as daily solve - problem solved in the past");
    
    return {
      success: true,
      dailySolved: false,
      message: "Problem was solved in the past, not counting as today's solve",
    };
  }
}

/**
 * Handle GET_STATUS message
 * Returns current problem, progress, and bypass status
 */
async function handleGetStatus() {
  // Get state first to know which problem set to load
  const state = await storage.getState();
  const selectedProblemSet = state.selectedProblemSet || "neetcode250";
  
  // Explicitly load the selected problem set to ensure cache is correct
  await problemLogic.loadProblemSet(selectedProblemSet);
  const problemSet = problemLogic.getProblemSet();
  
  if (!problemSet || !problemSet.categories) {
    return {
      success: false,
      error: "Problem set not loaded"
    };
  }
  
  const dailyState = await storage.getDailySolveState();
  const bypassState = await storage.getBypassState();
  const categoryProgress = await problemLogic.getAllCategoryProgress();

  const category = problemSet.categories[state.currentCategoryIndex];
  const problem = category?.problems[state.currentProblemIndex];

  const totalProblems = problemSet.categories.reduce(
    (sum, cat) => sum + cat.problems.length,
    0
  );

  // Count only solved problems that are in the current problem set
  const solvedCount = problemSet.categories.reduce((count, cat) => {
    return count + cat.problems.filter(p => state.solvedProblems.has(p.slug)).length;
  }, 0);

  return {
    success: true,
    currentProblem: problem,
    currentCategory: category?.name,
    categoryIndex: state.currentCategoryIndex,
    problemIndex: state.currentProblemIndex,
    totalProblems: totalProblems,
    solvedCount: solvedCount,
    dailySolvedToday: dailyState.solvedToday,
    bypass: bypassState,
    categoryProgress: categoryProgress,
  };
}

/**
 * Handle GET_DETAILED_PROGRESS message
 * Returns detailed progress for all categories and problems
 */
async function handleGetDetailedProgress() {
  // Get state first to know which problem set to load
  const state = await storage.getState();
  const selectedProblemSet = state.selectedProblemSet || "neetcode250";
  
  // Explicitly load the selected problem set to ensure cache is correct
  await problemLogic.loadProblemSet(selectedProblemSet);
  const problemSet = problemLogic.getProblemSet();
  
  if (!problemSet || !problemSet.categories) {
    return {
      success: false,
      error: "Problem set not loaded"
    };
  }
  
  // Get current problem slug for isCurrent comparison
  const currentCategory = problemSet.categories[state.currentCategoryIndex];
  const currentProblem = currentCategory?.problems[state.currentProblemIndex];
  const currentProblemSlug = currentProblem?.slug || null;
  
  // Check if sorting by difficulty is enabled
  const settings = await chrome.storage.sync.get(['sortByDifficulty']);
  const sortByDifficulty = settings.sortByDifficulty === true;
  
  const categories = problemSet.categories.map((cat, catIdx) => {
    // Get problems, sorted if needed
    let problems = cat.problems;
    if (sortByDifficulty) {
      problems = problemLogic.sortProblemsByDifficulty(cat.problems);
    }
    
    return {
      name: cat.name,
      total: cat.problems.length,
      solved: cat.problems.filter(p => state.solvedProblems.has(p.slug)).length,
      problems: problems.map((p) => ({
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        solved: state.solvedProblems.has(p.slug),
        // Use slug-based comparison for isCurrent to work with sorting
        isCurrent: p.slug === currentProblemSlug
      }))
    };
  });
  
  return { success: true, categories };
}

/**
 * Handle REFRESH_STATUS message
 * Recomputes problem status and restores redirects
 */
async function handleRefreshStatus() {
  const nextProblem = await problemLogic.computeNextProblem();
  await redirects.checkAndRestoreRedirect();

  return {
    success: true,
    problem: nextProblem,
  };
}

/**
 * Handle RESET_PROGRESS message
 * Clears all solved problems and resets all position states to 0,0 for all problem sets
 */
async function handleResetProgress() {
  console.log("Resetting all progress...");
  
  // Clear all solved problems
  await chrome.storage.sync.set({ solvedProblems: [] });
  
  // Reset all positions for all problem sets to 0,0
  await storage.resetAllPositions();
  
  // Clear local storage (daily solve, bypass, etc.)
  await chrome.storage.local.clear();
  
  // Force reload problem set for current selection
  const state = await storage.getState();
  await problemLogic.loadProblemSet(state.selectedProblemSet);
  const problemSet = problemLogic.getProblemSet();
  
  if (problemSet && problemSet.categories && problemSet.categories.length > 0) {
    const firstProblem = problemSet.categories[0].problems[0];
    console.log("Progress reset complete. Starting from:", firstProblem.slug);
  }
  
  // Reinstall redirect rule
  await redirects.installRedirectRule();
  
  return { success: true };
}

