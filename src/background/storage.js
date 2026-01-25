// ============================================================================
// LEETCODE BUDDY - STORAGE MODULE
// ============================================================================
// All chrome.storage operations consolidated in one place
// Handles state management, daily solve tracking, and bypass state
// ============================================================================

/**
 * Migrate old storage format to new per-set positions format
 * @param {Object} result - Storage result object
 * @returns {Promise<void>}
 */
async function migrateStorageIfNeeded(result) {
  // Check if migration is needed (old format has currentCategoryIndex at root)
  if (result.currentCategoryIndex !== undefined && !result.positions) {
    console.log("Migrating storage from old format to per-set positions format");
    
    const positions = {
      blind75: { categoryIndex: 0, problemIndex: 0 },
      neetcode150: { categoryIndex: 0, problemIndex: 0 },
      neetcode250: {
        categoryIndex: result.currentCategoryIndex || 0,
        problemIndex: result.currentProblemIndex || 0
      },
      neetcodeAll: { categoryIndex: 0, problemIndex: 0 }
    };
    
    // Save migrated data
    await chrome.storage.sync.set({
      positions: positions,
      solvedProblems: result.solvedProblems || [],
      selectedProblemSet: result.selectedProblemSet || "neetcode250"
    });
    
    // Remove old keys
    await chrome.storage.sync.remove(["currentCategoryIndex", "currentProblemIndex"]);
  }
}

/**
 * Get position for a specific problem set
 * @param {string} setId - Problem set ID
 * @returns {Promise<Object>} Position object with categoryIndex and problemIndex
 */
export async function getPositionForSet(setId) {
  const result = await chrome.storage.sync.get(["positions"]);
  const positions = result.positions || {};
  
  if (positions[setId]) {
    return {
      categoryIndex: positions[setId].categoryIndex || 0,
      problemIndex: positions[setId].problemIndex || 0
    };
  }
  
  // Default to 0,0 for new sets
  return { categoryIndex: 0, problemIndex: 0 };
}

/**
 * Save position for a specific problem set
 * @param {string} setId - Problem set ID
 * @param {number} categoryIndex - Current category index
 * @param {number} problemIndex - Current problem index within category
 * @returns {Promise<void>}
 */
export async function savePositionForSet(setId, categoryIndex, problemIndex) {
  const result = await chrome.storage.sync.get(["positions"]);
  const positions = result.positions || {};
  
  positions[setId] = { categoryIndex, problemIndex };
  
  await chrome.storage.sync.set({ positions });
}

/**
 * Get current state from chrome.storage.sync
 * @returns {Promise<Object>} State object with position for selected set, solvedProblems Set, and selectedProblemSet
 */
export async function getState() {
  const result = await chrome.storage.sync.get([
    "solvedProblems",
    "currentCategoryIndex",
    "currentProblemIndex",
    "selectedProblemSet",
    "positions",
  ]);
  
  // Migrate if needed
  await migrateStorageIfNeeded(result);
  
  const selectedProblemSet = result.selectedProblemSet || "neetcode250";
  
  // Get position for selected set
  const position = await getPositionForSet(selectedProblemSet);
  
  return {
    solvedProblems: new Set(result.solvedProblems || []),
    currentCategoryIndex: position.categoryIndex,
    currentProblemIndex: position.problemIndex,
    selectedProblemSet: selectedProblemSet,
  };
}

/**
 * Save current state to chrome.storage.sync
 * @param {number} categoryIndex - Current category index
 * @param {number} problemIndex - Current problem index within category
 * @param {Set<string>} solvedProblems - Set of solved problem slugs
 * @param {string} [problemSetId] - Optional problem set ID (uses selectedProblemSet from storage if not provided)
 * @returns {Promise<void>}
 */
export async function saveState(categoryIndex, problemIndex, solvedProblems, problemSetId = null) {
  // Get selected problem set if not provided
  if (!problemSetId) {
    const state = await chrome.storage.sync.get(["selectedProblemSet"]);
    problemSetId = state.selectedProblemSet || "neetcode250";
  }
  
  // Save position for the specific set
  await savePositionForSet(problemSetId, categoryIndex, problemIndex);
  
  // Save shared solved problems
  await chrome.storage.sync.set({
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

/**
 * Reset all positions for all problem sets to 0,0
 * @returns {Promise<void>}
 */
export async function resetAllPositions() {
  const positions = {
    blind75: { categoryIndex: 0, problemIndex: 0 },
    neetcode150: { categoryIndex: 0, problemIndex: 0 },
    neetcode250: { categoryIndex: 0, problemIndex: 0 },
    neetcodeAll: { categoryIndex: 0, problemIndex: 0 }
  };
  
  await chrome.storage.sync.set({ positions });
}

/**
 * Get the date when a problem was first opened today
 * @param {string} problemSlug - Problem slug
 * @returns {Promise<string|null>} Date string (YYYY-MM-DD) or null if not opened today
 */
export async function getProblemFirstOpenDate(problemSlug) {
  const key = `problemFirstOpened_${problemSlug}`;
  const result = await chrome.storage.local.get([key]);
  const storedDate = result[key];
  
  if (!storedDate) {
    return null;
  }
  
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  // Return the date if it's today, otherwise null
  return storedDate === today ? storedDate : null;
}

/**
 * Check if this is the first time opening a problem today
 * @param {string} problemSlug - Problem slug
 * @returns {Promise<boolean>} True if this is the first open today
 */
export async function isFirstOpenToday(problemSlug) {
  const firstOpenDate = await getProblemFirstOpenDate(problemSlug);
  return firstOpenDate === null;
}

/**
 * Mark a problem as opened for today
 * @param {string} problemSlug - Problem slug
 * @returns {Promise<void>}
 */
export async function markProblemFirstOpened(problemSlug) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const key = `problemFirstOpened_${problemSlug}`;
  
  await chrome.storage.local.set({ [key]: today });
  console.log(`Problem ${problemSlug} marked as first opened on ${today}`);
}

