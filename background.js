// Leetcode Buddy - Background Service Worker with Category Support and Daily Solve

const WHITELIST = ["leetcode.com", "neetcode.io", "chatgpt.com"];
const REDIRECT_RULE_ID = 1000;
const BYPASS_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_DURATION_MS = 30 * 60 * 1000; // 30 minutes

let problemSet = null; // Loaded from neetcode250.json
let problemAliases = {}; // Loaded from problemAliases.json
let currentProblemSlug = null;
let currentCategoryIndex = 0;
let currentProblemIndex = 0;

// Load the problem set JSON
async function loadProblemSet() {
  if (problemSet) return problemSet;
  
  try {
    const response = await fetch(chrome.runtime.getURL("neetcode250.json"));
    problemSet = await response.json();
    return problemSet;
  } catch (error) {
    console.error("Failed to load problem set:", error);
    return null;
  }
}

// Load problem aliases
async function loadAliases() {
  try {
    const response = await fetch(chrome.runtime.getURL("problemAliases.json"));
    problemAliases = await response.json();
    return problemAliases;
  } catch (error) {
    console.error("Failed to load aliases:", error);
    return {};
  }
}

// Resolve alias to canonical slug
function resolveAlias(slug) {
  return problemAliases[slug] || slug;
}

// Get current state from storage
async function getState() {
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

// Save current state to storage
async function saveState(categoryIndex, problemIndex, solvedProblems) {
  await chrome.storage.sync.set({
    currentCategoryIndex: categoryIndex,
    currentProblemIndex: problemIndex,
    solvedProblems: Array.from(solvedProblems),
  });
}

// Get daily solve state
async function getDailySolveState() {
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

// Mark daily solve
async function markDailySolve() {
  const now = Date.now();
  const today = new Date().toISOString().split("T")[0];
  
  await chrome.storage.local.set({
    dailySolveDate: today,
    dailySolveTimestamp: now,
  });
  
  // Remove redirect rule - unblock all websites
  await removeRedirectRule();
  
  console.log("Daily problem solved! Websites unblocked until midnight.");
}

// Check if day has changed and reset daily solve
async function checkDailyReset() {
  const dailyState = await getDailySolveState();
  const today = new Date().toISOString().split("T")[0];
  
  if (dailyState.lastSolveDate && dailyState.lastSolveDate !== today) {
    // Day has changed, reset daily solve and restore redirects
    console.log("New day detected, resetting daily solve status");
    await chrome.storage.local.remove([
      "dailySolveDate", 
      "dailySolveTimestamp", 
      "celebrationShownDate"
    ]);
    await installRedirectRule();
  }
}

// Check bypass status
async function getBypassState() {
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

// Activate bypass mode
async function activateBypass() {
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

  await chrome.storage.local.set({ bypassUntil, nextBypassAllowed });
  await removeRedirectRule();

  return { success: true, bypassUntil, nextBypassAllowed };
}

// Fetch all problem statuses from LeetCode API
async function fetchAllProblemStatuses() {
  try {
    const response = await fetch("https://leetcode.com/api/problems/all/", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch problem statuses");
    }

    const data = await response.json();
    const statusMap = new Map();

    for (const item of data.stat_status_pairs || []) {
      const slug = item?.stat?.question__title_slug;
      const status = item?.status;
      if (slug) {
        statusMap.set(slug, status);
        // Also map aliases
        const canonicalSlug = resolveAlias(slug);
        if (canonicalSlug !== slug) {
          statusMap.set(canonicalSlug, status);
        }
      }
    }

    return statusMap;
  } catch (error) {
    console.error("Failed to fetch all problem statuses:", error);
    return new Map();
  }
}

// Compute category progress
function computeCategoryProgress(category, solvedProblems) {
  const solved = category.problems.filter((p) =>
    solvedProblems.has(p.slug)
  ).length;
  const total = category.problems.length;
  return { solved, total, percentage: total > 0 ? (solved / total) * 100 : 0 };
}

// Compute next unsolved problem across all categories
async function computeNextProblem() {
  await loadProblemSet();
  await loadAliases();
  
  if (!problemSet || !problemSet.categories) {
    console.error("Problem set not loaded");
    return null;
  }

  const state = await getState();
  const statusMap = await fetchAllProblemStatuses();
  const solvedProblems = new Set();

  // Iterate through all categories to find first unsolved problem
  for (let catIdx = 0; catIdx < problemSet.categories.length; catIdx++) {
    const category = problemSet.categories[catIdx];
    
    for (let probIdx = 0; probIdx < category.problems.length; probIdx++) {
      const problem = category.problems[probIdx];
      const canonicalSlug = resolveAlias(problem.slug);
      const status = statusMap.get(canonicalSlug);

      if (status === "ac") {
        solvedProblems.add(problem.slug);
      } else {
        // Found first unsolved problem
        currentCategoryIndex = catIdx;
        currentProblemIndex = probIdx;
        currentProblemSlug = problem.slug;
        
        await saveState(catIdx, probIdx, solvedProblems);
        
        return {
          categoryIndex: catIdx,
          categoryName: category.name,
          problemIndex: probIdx,
          problem: problem,
          totalProblems: problemSet.categories.reduce(
            (sum, cat) => sum + cat.problems.length,
            0
          ),
          solvedCount: solvedProblems.size,
          categoryProgress: computeCategoryProgress(category, solvedProblems),
        };
      }
    }
  }

  // All problems solved
  const totalProblems = problemSet.categories.reduce(
    (sum, cat) => sum + cat.problems.length,
    0
  );
  
  if (solvedProblems.size === totalProblems) {
    console.log("All problems solved!");
    currentCategoryIndex = problemSet.categories.length - 1;
    currentProblemIndex = problemSet.categories[currentCategoryIndex].problems.length - 1;
    const lastProblem = problemSet.categories[currentCategoryIndex].problems[currentProblemIndex];
    currentProblemSlug = lastProblem.slug;
    
    await saveState(currentCategoryIndex, currentProblemIndex, solvedProblems);
    
    return {
      categoryIndex: currentCategoryIndex,
      categoryName: problemSet.categories[currentCategoryIndex].name,
      problemIndex: currentProblemIndex,
      problem: lastProblem,
      totalProblems: totalProblems,
      solvedCount: solvedProblems.size,
      allSolved: true,
    };
  }

  return null;
}

// Get all category progress for display
async function getAllCategoryProgress() {
  await loadProblemSet();
  if (!problemSet) return [];

  const state = await getState();
  const categoryProgress = [];

  for (const category of problemSet.categories) {
    const progress = computeCategoryProgress(category, state.solvedProblems);
    categoryProgress.push({
      name: category.name,
      solved: progress.solved,
      total: progress.total,
      percentage: progress.percentage,
    });
  }

  return categoryProgress;
}

// Install or update the redirect rule
async function installRedirectRule() {
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
  if (!problemSet) return;

  const state = await getState();
  
  // Get current problem
  const category = problemSet.categories[state.currentCategoryIndex];
  if (!category) return;
  
  const problem = category.problems[state.currentProblemIndex];
  if (!problem) return;

  const targetUrl = `https://leetcode.com/problems/${problem.slug}/`;

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
      excludedRequestDomains: WHITELIST,
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

// Remove the redirect rule
async function removeRedirectRule() {
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

// Check and restore redirect after bypass expires or daily reset
async function checkAndRestoreRedirect() {
  const dailyState = await getDailySolveState();
  const bypassState = await getBypassState();

  if (!dailyState.solvedToday && !bypassState.isActive) {
    await installRedirectRule();
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log("NeetCode 250 Enforcer installed");
  await loadAliases();
  await computeNextProblem();
  await installRedirectRule();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log("Leetcode Buddy started");
  await loadAliases();
  await checkDailyReset();
  await computeNextProblem();
  await checkAndRestoreRedirect();
});

// Periodically check for daily reset and bypass expiration (every minute)
setInterval(async () => {
  await checkDailyReset();
  await checkAndRestoreRedirect();
}, 60 * 1000);

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "PROBLEM_SOLVED") {
        console.log("Problem solved:", message.slug);

        // Mark daily solve
        await markDailySolve();

        // Recompute next problem for tomorrow
        const nextProblem = await computeNextProblem();

        sendResponse({
          success: true,
          nextProblem: nextProblem,
          dailySolved: true,
        });
      } else if (message.type === "GET_STATUS") {
        await loadProblemSet();
        const state = await getState();
        const dailyState = await getDailySolveState();
        const bypassState = await getBypassState();
        const categoryProgress = await getAllCategoryProgress();

        const category = problemSet.categories[state.currentCategoryIndex];
        const problem = category?.problems[state.currentProblemIndex];

        const totalProblems = problemSet.categories.reduce(
          (sum, cat) => sum + cat.problems.length,
          0
        );

        sendResponse({
          success: true,
          currentProblem: problem,
          currentCategory: category?.name,
          categoryIndex: state.currentCategoryIndex,
          problemIndex: state.currentProblemIndex,
          totalProblems: totalProblems,
          solvedCount: state.solvedProblems.size,
          dailySolvedToday: dailyState.solvedToday,
          bypass: bypassState,
          categoryProgress: categoryProgress,
        });
      } else if (message.type === "ACTIVATE_BYPASS") {
        const result = await activateBypass();
        sendResponse(result);
      } else if (message.type === "REFRESH_STATUS") {
        const nextProblem = await computeNextProblem();
        await checkAndRestoreRedirect();

        sendResponse({
          success: true,
          problem: nextProblem,
        });
      } else if (message.type === "RESET_PROGRESS") {
        console.log("Resetting all progress...");
        
        // Clear all storage
        await chrome.storage.sync.clear();
        await chrome.storage.local.clear();
        
        // Reset in-memory state
        problemSet = null;
        currentCategoryIndex = 0;
        currentProblemIndex = 0;
        currentProblemSlug = null;
        
        // Force reload problem set
        await loadProblemSet();
        
        // Initialize to first problem with empty solved set
        const firstProblem = problemSet.categories[0].problems[0];
        currentCategoryIndex = 0;
        currentProblemIndex = 0;
        currentProblemSlug = firstProblem.slug;
        
        await saveState(0, 0, new Set());
        
        // Reinstall redirect rule
        await installRedirectRule();
        
        console.log("Progress reset complete. Starting from:", firstProblem.slug);
        
        sendResponse({ success: true });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep the message channel open for async response
});
