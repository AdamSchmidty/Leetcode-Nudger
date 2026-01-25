// ============================================================================
// LEETCODE BUDDY - PROBLEM LOGIC MODULE
// ============================================================================
// Handles problem set loading, progression tracking, and statistics
// ============================================================================

import { PROBLEM_SET_PATH, ALIASES_PATH } from '../shared/constants.js';
import { getState, saveState } from './storage.js';

// In-memory caches
let problemSet = null;
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
  problemAliases = {};
}

/**
 * Load the problem set JSON from assets
 * @returns {Promise<Object|null>} The problem set object or null on error
 */
export async function loadProblemSet() {
  if (problemSet) return problemSet;
  
  try {
    const response = await fetch(chrome.runtime.getURL(PROBLEM_SET_PATH));
    problemSet = await response.json();
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
  await loadProblemSet();
  await loadAliases();
  
  if (!problemSet || !problemSet.categories) {
    console.error("Problem set not loaded");
    return null;
  }

  const state = await getState();
  const statusMap = await fetchAllProblemStatuses();
  
  // Start with existing solved problems from state
  const solvedProblems = new Set(state.solvedProblems || []);
  
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
  const settings = await chrome.storage.sync.get(['sortByDifficulty']);
  const sortByDifficulty = settings.sortByDifficulty === true;

  // Second pass: Find first unsolved problem in order
  for (let catIdx = 0; catIdx < problemSet.categories.length; catIdx++) {
    const category = problemSet.categories[catIdx];
    
    // Get problems, sorted if needed
    let problemsToCheck = category.problems;
    if (sortByDifficulty) {
      problemsToCheck = sortProblemsByDifficulty(category.problems);
    }
    
    for (let probIdx = 0; probIdx < problemsToCheck.length; probIdx++) {
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
        
        await saveState(catIdx, originalProbIdx, solvedProblems);
        
        return {
          categoryIndex: catIdx,
          categoryName: category.name,
          problemIndex: originalProbIdx,
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

/**
 * Get all category progress for display
 * @returns {Promise<Array>} Array of category progress objects
 */
export async function getAllCategoryProgress() {
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

/**
 * Get the cached problem set (for direct access)
 * @returns {Object|null} The problem set or null
 */
export function getProblemSet() {
  return problemSet;
}

