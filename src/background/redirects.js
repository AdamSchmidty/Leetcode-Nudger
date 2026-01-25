// ============================================================================
// LEETCODE BUDDY - REDIRECTS MODULE
// ============================================================================
// Handles declarativeNetRequest rules, bypass management, and daily reset
// ============================================================================

import { getExclusionList, REDIRECT_RULE_ID, BYPASS_DURATION_MS, COOLDOWN_DURATION_MS } from '../shared/constants.js';
import { getDailySolveState, clearDailySolve, getBypassState, setBypassState } from './storage.js';
import { loadProblemSet, getProblemSet } from './problemLogic.js';
import { getState } from './storage.js';

/**
 * Install or update the declarativeNetRequest redirect rule
 * Only installs if daily solve is NOT complete and bypass is NOT active
 * @returns {Promise<void>}
 */
export async function installRedirectRule() {
  // Check if daily solve is complete
  const dailyState = await getDailySolveState();
  if (dailyState.solvedToday) {
    console.log("Daily problem already solved, not installing redirect rule");
    return;
  }

  const bypassState = await getBypassState();
  if (bypassState.isActive) {
    console.log("Bypass active, skipping redirect rule installation");
    return;
  }

  await loadProblemSet();
  const problemSet = getProblemSet();
  if (!problemSet) return;

  const state = await getState();
  
  // Get current problem
  const category = problemSet.categories[state.currentCategoryIndex];
  if (!category) return;
  
  const problem = category.problems[state.currentProblemIndex];
  if (!problem) return;

  const targetUrl = `https://leetcode.com/problems/${problem.slug}/`;

  // Get exclusion list from storage (with fallback to defaults)
  const exclusionList = await getExclusionList();

  const rule = {
    id: REDIRECT_RULE_ID,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { url: targetUrl },
    },
    condition: {
      urlFilter: "|http",
      resourceTypes: ["main_frame"],
      excludedRequestDomains: exclusionList,
    },
  };

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [REDIRECT_RULE_ID],
      addRules: [rule],
    });
    console.log(`Redirect rule installed: ${targetUrl}`);
  } catch (error) {
    console.error("Failed to install redirect rule:", error);
  }
}

/**
 * Remove the declarativeNetRequest redirect rule
 * @returns {Promise<void>}
 */
export async function removeRedirectRule() {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [REDIRECT_RULE_ID],
      addRules: [],
    });
    console.log("Redirect rule removed");
  } catch (error) {
    console.error("Failed to remove redirect rule:", error);
  }
}

/**
 * Check and restore redirect after bypass expires or daily reset
 * @returns {Promise<void>}
 */
export async function checkAndRestoreRedirect() {
  const dailyState = await getDailySolveState();
  const bypassState = await getBypassState();

  if (!dailyState.solvedToday && !bypassState.isActive) {
    await installRedirectRule();
  }
}

/**
 * Activate bypass mode (10-minute break from redirects)
 * @returns {Promise<Object>} Result object with success status
 */
export async function activateBypass() {
  const bypassState = await getBypassState();

  if (!bypassState.canBypass) {
    return {
      success: false,
      reason: "cooldown",
      remainingMs: bypassState.nextAllowedMs,
    };
  }

  const now = Date.now();
  const bypassUntil = now + BYPASS_DURATION_MS;
  const nextBypassAllowed = bypassUntil + COOLDOWN_DURATION_MS;

  await setBypassState(bypassUntil, nextBypassAllowed);
  await removeRedirectRule();

  return { success: true, bypassUntil, nextBypassAllowed };
}

/**
 * Check if day has changed and reset daily solve status
 * Clears daily solve data and reinstalls redirect rule
 * @returns {Promise<void>}
 */
export async function checkDailyReset() {
  const dailyState = await getDailySolveState();
  const today = new Date().toISOString().split("T")[0];
  
  if (dailyState.lastSolveDate && dailyState.lastSolveDate !== today) {
    // Day has changed, reset daily solve and restore redirects
    console.log("New day detected, resetting daily solve status");
    await clearDailySolve();
    await installRedirectRule();
  }
}

