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
 * @returns {Promise<Object|null>} Next problem info or null if error
 */
export async function computeNextProblem() {
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
      const canonicalSlug = resolveProblemAlias(problem.slug);
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

