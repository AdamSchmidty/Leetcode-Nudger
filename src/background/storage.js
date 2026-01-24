// ============================================================================
// LEETCODE BUDDY - STORAGE MODULE
// ============================================================================
// All chrome.storage operations consolidated in one place
// Handles state management, daily solve tracking, and bypass state
// ============================================================================

/**
 * Get current state from chrome.storage.sync
 * @returns {Promise<Object>} State object with currentCategoryIndex, currentProblemIndex, and solvedProblems Set
 */
export async function getState() {
  const result = await chrome.storage.sync.get([
    "solvedProblems",
    "currentCategoryIndex",
    "currentProblemIndex",
    "selectedProblemSet",
  ]);
  return {
    solvedProblems: new Set(result.solvedProblems || []),
    currentCategoryIndex: result.currentCategoryIndex || 0,
    currentProblemIndex: result.currentProblemIndex || 0,
    selectedProblemSet: result.selectedProblemSet || "neetcode250",
  };
}

/**
 * Save current state to chrome.storage.sync
 * @param {number} categoryIndex - Current category index
 * @param {number} problemIndex - Current problem index within category
 * @param {Set<string>} solvedProblems - Set of solved problem slugs
 * @returns {Promise<void>}
 */
export async function saveState(categoryIndex, problemIndex, solvedProblems) {
  await chrome.storage.sync.set({
    currentCategoryIndex: categoryIndex,
    currentProblemIndex: problemIndex,
    solvedProblems: Array.from(solvedProblems),
  });
}

/**
 * Get daily solve state from chrome.storage.local
 * @returns {Promise<Object>} Object with solvedToday, lastSolveDate, lastSolveTimestamp
 */
export async function getDailySolveState() {
  const result = await chrome.storage.local.get([
    "dailySolveDate",
    "dailySolveTimestamp",
  ]);
  
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const lastSolveDate = result.dailySolveDate || "";
  
  return {
    solvedToday: lastSolveDate === today,
    lastSolveDate: lastSolveDate,
    lastSolveTimestamp: result.dailySolveTimestamp || 0,
  };
}

/**
 * Mark daily solve and store problem slug
 * @param {string} problemSlug - The slug of the problem that was solved
 * @returns {Promise<void>}
 */
export async function markDailySolve(problemSlug) {
  const now = Date.now();
  const today = new Date().toISOString().split("T")[0];
  
  await chrome.storage.local.set({
    dailySolveDate: today,
    dailySolveTimestamp: now,
    dailySolveProblem: problemSlug,
  });
  
  console.log(`Daily solve marked: ${problemSlug}`);
}

/**
 * Clear daily solve data (for daily reset)
 * @returns {Promise<void>}
 */
export async function clearDailySolve() {
  await chrome.storage.local.remove([
    "dailySolveDate",
    "dailySolveTimestamp",
    "dailySolveProblem",
    "celebrationShownDate"
  ]);
}

/**
 * Get bypass state from chrome.storage.local
 * @returns {Promise<Object>} Bypass state with isActive, remainingMs, canBypass, nextAllowedMs
 */
export async function getBypassState() {
  const result = await chrome.storage.local.get([
    "bypassUntil",
    "nextBypassAllowed",
  ]);
  const now = Date.now();

  const bypassUntil = result.bypassUntil || 0;
  const nextBypassAllowed = result.nextBypassAllowed || 0;

  return {
    isActive: now < bypassUntil,
    remainingMs: Math.max(0, bypassUntil - now),
    canBypass: now >= nextBypassAllowed,
    nextAllowedMs: Math.max(0, nextBypassAllowed - now),
  };
}

/**
 * Set bypass state in chrome.storage.local
 * @param {number} bypassUntil - Timestamp when bypass expires
 * @param {number} nextBypassAllowed - Timestamp when next bypass can be activated
 * @returns {Promise<void>}
 */
export async function setBypassState(bypassUntil, nextBypassAllowed) {
  await chrome.storage.local.set({ bypassUntil, nextBypassAllowed });
}

/**
 * Clear bypass state (for daily reset or manual clear)
 * @returns {Promise<void>}
 */
export async function clearBypass() {
  await chrome.storage.local.remove(["bypassUntil", "nextBypassAllowed"]);
}

