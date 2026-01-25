// ============================================================================
// LEETCODE BUDDY - PROBLEM LOGIC MODULE
// ============================================================================
// Handles problem set loading, progression tracking, and statistics
// ============================================================================

import { getProblemSetPath, ALIASES_PATH } from '../shared/constants.js';
import { getState, saveState, getPositionForSet } from './storage.js';

// In-memory caches
let problemSet = null;
let currentProblemSetId = null;
let problemAliases = {};

// Current problem tracking
export let currentProblemSlug = null;
export let currentCategoryIndex = 0;
export let currentProblemIndex = 0;

/**
 * Clear caches (for testing purposes)
 * @returns {void}
 */
export function clearCaches() {
  problemSet = null;
  currentProblemSetId = null;
  problemAliases = {};
}

/**
 * Load the problem set JSON from assets
 * @param {string} [problemSetId] - Optional problem set ID. If not provided, loads from selectedProblemSet in storage
 * @returns {Promise<Object|null>} The problem set object or null on error
 */
export async function loadProblemSet(problemSetId = null) {
  // Get problem set ID if not provided
  if (!problemSetId) {
    const state = await chrome.storage.sync.get(["selectedProblemSet"]);
    problemSetId = state.selectedProblemSet || "neetcode250";
  }
  
  // Return cached set if it's the same
  if (problemSet && currentProblemSetId === problemSetId) {
    return problemSet;
  }
  
  // Clear cache if switching sets
  if (currentProblemSetId && currentProblemSetId !== problemSetId) {
    problemSet = null;
  }
  
  try {
    const path = getProblemSetPath(problemSetId);
    const response = await fetch(chrome.runtime.getURL(path));
    problemSet = await response.json();
    currentProblemSetId = problemSetId;
    return problemSet;
  } catch (error) {
    console.error("Failed to load problem set:", error);
    return null;
  }
}

/**
 * Load problem aliases mapping from assets
 * @returns {Promise<Object>} The aliases object
 */
export async function loadAliases() {
  try {
    const response = await fetch(chrome.runtime.getURL(ALIASES_PATH));
    problemAliases = await response.json();
    console.log("Problem aliases loaded:", Object.keys(problemAliases).length);
    return problemAliases;
  } catch (error) {
    console.error("Failed to load aliases:", error);
    return {};
  }
}

/**
 * Resolve alias to canonical LeetCode slug
 * @param {string} slug - Problem slug (may be alias)
 * @returns {string} Canonical slug
 */
export function resolveProblemAlias(slug) {
  return problemAliases[slug] || slug;
}

/**
 * Find alias for a canonical slug (reverse lookup)
 * @param {string} canonicalSlug - Canonical problem slug
 * @returns {string|null} Alias if found, null otherwise
 */
function findAliasForSlug(canonicalSlug) {
  for (const [alias, canonical] of Object.entries(problemAliases)) {
    if (canonical === canonicalSlug) {
      return alias;
    }
  }
  return null;
}

/**
 * Get the slug to use for NeetCode URL
 * Uses alias if available, otherwise uses the original slug
 * @param {string} slug - Problem slug (canonical or alias)
 * @returns {string} Slug to use for NeetCode URL
 */
export function getNeetCodeSlug(slug) {
  // First check if the slug itself is an alias
  if (problemAliases[slug]) {
    // It's an alias, use it directly
    return slug;
  }
  
  // Check if there's an alias for this canonical slug
  const alias = findAliasForSlug(slug);
  if (alias) {
    return alias;
  }
  
  // No alias found, use original slug
  return slug;
}

/**
 * Get NeetCode solution URL for a problem
 * @param {string} slug - Problem slug
 * @returns {string} NeetCode solution URL
 */
export function getNeetCodeUrl(slug) {
  const neetcodeSlug = getNeetCodeSlug(slug);
  return `https://neetcode.io/solutions/${neetcodeSlug}`;
}

/**
 * Sort problems by difficulty (Easy → Medium → Hard)
 * @param {Array} problems - Array of problem objects
 * @returns {Array} Sorted array of problems
 */
export function sortProblemsByDifficulty(problems) {
  const difficultyOrder = { Easy: 0, Medium: 1, Hard: 2 };
  
  return [...problems].sort((a, b) => {
    const diffA = difficultyOrder[a.difficulty] ?? 999;
    const diffB = difficultyOrder[b.difficulty] ?? 999;
    return diffA - diffB;
  });
}

/**
 * Fetch all problem statuses from LeetCode API
 * @returns {Promise<Map>} Map of problem slug to status
 * @exports For testing purposes
 */
export async function fetchAllProblemStatuses() {
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
        const canonicalSlug = resolveProblemAlias(slug);
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

/**
 * Compute category progress
 * @param {Object} category - Category object
 * @param {Set<string>} solvedProblems - Set of solved problem slugs
 * @returns {Object} Progress object with solved, total, percentage
 * @exports For testing purposes
 */
export function computeCategoryProgress(category, solvedProblems) {
  const solved = category.problems.filter((p) =>
    solvedProblems.has(p.slug)
  ).length;
  const total = category.problems.length;
  return { solved, total, percentage: total > 0 ? (solved / total) * 100 : 0 };
}

/**
 * Compute next unsolved problem across all categories
 * Syncs with LeetCode to get current solve status
 * @param {boolean} syncAllSolved - If true, scan all problems and mark all solved ones (for first install only)
 * @returns {Promise<Object|null>} Next problem info or null if error
 */
export async function computeNextProblem(syncAllSolved = false) {
  // Get selected problem set
  const state = await getState();
  const selectedProblemSet = state.selectedProblemSet || "neetcode250";
  
  // Load the correct problem set
  await loadProblemSet(selectedProblemSet);
  await loadAliases();
  
  if (!problemSet || !problemSet.categories) {
    console.error("Problem set not loaded");
    return null;
  }

  const statusMap = await fetchAllProblemStatuses();
  
  // Start with existing solved problems from state (shared across all sets)
  const solvedProblems = new Set(state.solvedProblems || []);
  
  // Get position state for the selected set (defaults to 0,0 if not set)
  const position = await getPositionForSet(selectedProblemSet);
  let startCategoryIndex = position.categoryIndex;
  let startProblemIndex = position.problemIndex;
  
  // First pass: Mark ALL solved problems (only on first install)
  // This ensures all solved problems are tracked when extension is first installed
  // But respects user's reset progress choice on subsequent startups
  if (syncAllSolved) {
    for (let catIdx = 0; catIdx < problemSet.categories.length; catIdx++) {
      const category = problemSet.categories[catIdx];
      
      for (let probIdx = 0; probIdx < category.problems.length; probIdx++) {
        const problem = category.problems[probIdx];
        const canonicalSlug = resolveProblemAlias(problem.slug);
        const status = statusMap.get(canonicalSlug);

        if (status === "ac") {
          solvedProblems.add(problem.slug);
        }
      }
    }
  }

  // Check if sorting by difficulty is enabled
  const settings = await chrome.storage.sync.get(['sortByDifficulty', 'randomProblemSelection']);
  const sortByDifficulty = settings.sortByDifficulty === true;
  const randomProblemSelection = settings.randomProblemSelection === true;

  // If random selection is enabled, collect all unsolved problems and pick one randomly
  if (randomProblemSelection) {
    const unsolvedProblems = [];
    
    // Collect all unsolved problems with their category and original index
    for (let catIdx = 0; catIdx < problemSet.categories.length; catIdx++) {
      const category = problemSet.categories[catIdx];
      
      for (let probIdx = 0; probIdx < category.problems.length; probIdx++) {
        const problem = category.problems[probIdx];
        
        if (!solvedProblems.has(problem.slug)) {
          unsolvedProblems.push({
            problem: problem,
            categoryIndex: catIdx,
            problemIndex: probIdx,
            category: category
          });
        }
      }
    }
    
    // If there are unsolved problems, pick one randomly
    if (unsolvedProblems.length > 0) {
      const randomIndex = Math.floor(Math.random() * unsolvedProblems.length);
      const selected = unsolvedProblems[randomIndex];
      
      currentCategoryIndex = selected.categoryIndex;
      currentProblemIndex = selected.problemIndex;
      currentProblemSlug = selected.problem.slug;
      
      // Save position for the selected set (still track position for compatibility)
      await saveState(selected.categoryIndex, selected.problemIndex, solvedProblems, selectedProblemSet);
      
      const totalProblems = problemSet.categories.reduce(
        (sum, cat) => sum + cat.problems.length,
        0
      );
      
      // Count only solved problems that are in the current problem set
      const solvedCount = problemSet.categories.reduce((count, cat) => {
        return count + cat.problems.filter(p => solvedProblems.has(p.slug)).length;
      }, 0);
      
      return {
        categoryIndex: selected.categoryIndex,
        categoryName: selected.category.name,
        problemIndex: selected.problemIndex,
        problem: selected.problem,
        totalProblems: totalProblems,
        solvedCount: solvedCount,
        categoryProgress: computeCategoryProgress(selected.category, solvedProblems),
      };
    }
    // If no unsolved problems, fall through to "all solved" logic below
  } else {
    // Sequential selection: Find first unsolved problem in order, starting from saved position
    for (let catIdx = startCategoryIndex; catIdx < problemSet.categories.length; catIdx++) {
      const category = problemSet.categories[catIdx];
      
      // Get problems, sorted if needed
      let problemsToCheck = category.problems;
      if (sortByDifficulty) {
        problemsToCheck = sortProblemsByDifficulty(category.problems);
      }
      
      // Start from saved problem index if we're on the starting category
      const startIdx = (catIdx === startCategoryIndex) ? startProblemIndex : 0;
      
      for (let probIdx = startIdx; probIdx < problemsToCheck.length; probIdx++) {
        const problem = problemsToCheck[probIdx];
        
        if (!solvedProblems.has(problem.slug)) {
          // Found first unsolved problem
          // Find original index if sorted
          let originalProbIdx = probIdx;
          if (sortByDifficulty) {
            originalProbIdx = category.problems.findIndex(p => p.slug === problem.slug);
          }
          
          currentCategoryIndex = catIdx;
          currentProblemIndex = originalProbIdx;
          currentProblemSlug = problem.slug;
          
          // Save position for the selected set only
          await saveState(catIdx, originalProbIdx, solvedProblems, selectedProblemSet);
          
          const totalProblems = problemSet.categories.reduce(
            (sum, cat) => sum + cat.problems.length,
            0
          );
          
          // Count only solved problems that are in the current problem set
          const solvedCount = problemSet.categories.reduce((count, cat) => {
            return count + cat.problems.filter(p => solvedProblems.has(p.slug)).length;
          }, 0);
          
          return {
            categoryIndex: catIdx,
            categoryName: category.name,
            problemIndex: originalProbIdx,
            problem: problem,
            totalProblems: totalProblems,
            solvedCount: solvedCount,
            categoryProgress: computeCategoryProgress(category, solvedProblems),
          };
        }
      }
    }
  }

  // All problems solved
  const totalProblems = problemSet.categories.reduce(
    (sum, cat) => sum + cat.problems.length,
    0
  );
  
  // Count only solved problems that are in the current problem set
  const solvedCount = problemSet.categories.reduce((count, cat) => {
    return count + cat.problems.filter(p => solvedProblems.has(p.slug)).length;
  }, 0);
  
  if (solvedCount === totalProblems) {
    console.log("All problems solved!");
    currentCategoryIndex = problemSet.categories.length - 1;
    currentProblemIndex = problemSet.categories[currentCategoryIndex].problems.length - 1;
    const lastProblem = problemSet.categories[currentCategoryIndex].problems[currentProblemIndex];
    currentProblemSlug = lastProblem.slug;
    
    await saveState(currentCategoryIndex, currentProblemIndex, solvedProblems, selectedProblemSet);
    
    return {
      categoryIndex: currentCategoryIndex,
      categoryName: problemSet.categories[currentCategoryIndex].name,
      problemIndex: currentProblemIndex,
      problem: lastProblem,
      totalProblems: totalProblems,
      solvedCount: solvedCount,
      allSolved: true,
    };
  }

  return null;
}

/**
 * Get all category progress for display
 * @returns {Promise<Array>} Array of category progress objects
 */
export async function getAllCategoryProgress() {
  const state = await getState();
  const selectedProblemSet = state.selectedProblemSet || "neetcode250";
  
  await loadProblemSet(selectedProblemSet);
  if (!problemSet) return [];

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

/**
 * Get the cached problem set (for direct access)
 * @returns {Object|null} The problem set or null
 */
export function getProblemSet() {
  return problemSet;
}

