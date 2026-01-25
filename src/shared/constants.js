// ============================================================================
// LEETCODE BUDDY - SHARED CONSTANTS
// ============================================================================
// Shared constants used across background, content, popup, and options scripts
// ============================================================================

// Whitelist domains (websites that won't be redirected)
export const WHITELIST = [
  "leetcode.com",
  "neetcode.io",
  "chatgpt.com",
  "accounts.google.com",     // Google OAuth
  "github.com",              // GitHub OAuth
  "www.linkedin.com"         // LinkedIn OAuth
];

// Redirect rule configuration
export const REDIRECT_RULE_ID = 1000;

// Timing constants
export const BYPASS_DURATION_MS = 10 * 60 * 1000;      // 10 minutes
export const COOLDOWN_DURATION_MS = 30 * 60 * 1000;    // 30 minutes

// Data file paths
export const PROBLEM_SET_PATHS = {
  blind75: "src/assets/data/blind75.json",
  neetcode150: "src/assets/data/neetcode150.json",
  neetcode250: "src/assets/data/neetcode250.json",
  neetcodeAll: "src/assets/data/neetcodeAll.json"
};

/**
 * Get problem set path by ID
 * @param {string} problemSetId - The problem set ID
 * @returns {string} The path to the problem set JSON file
 */
export function getProblemSetPath(problemSetId) {
  return PROBLEM_SET_PATHS[problemSetId] || PROBLEM_SET_PATHS.neetcode250;
}

// Legacy export for backward compatibility (deprecated)
export const PROBLEM_SET_PATH = PROBLEM_SET_PATHS.neetcode250;

export const ALIASES_PATH = "src/assets/data/problemAliases.json";

