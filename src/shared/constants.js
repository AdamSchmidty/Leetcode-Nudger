// ============================================================================
// LEETCODE BUDDY - SHARED CONSTANTS
// ============================================================================
// Shared constants used across background, content, popup, and options scripts
// ============================================================================

// System-enforced domains (always excluded, not user-editable)
export const SYSTEM_EXCLUSION_LIST = [
  "leetcode.com",
  "neetcode.io",
  "accounts.google.com"     // Google OAuth
];

// Default user-editable exclusion list (examples pre-populated)
export const DEFAULT_USER_EXCLUSION_LIST = [
  "github.com",
  "linkedin.com"
];

// Legacy export for backward compatibility (deprecated - use getExclusionList() instead)
export const WHITELIST = [...SYSTEM_EXCLUSION_LIST, ...DEFAULT_USER_EXCLUSION_LIST];
export const DEFAULT_EXCLUSION_LIST = WHITELIST;

/**
 * Get the complete exclusion list (system + user domains)
 * @returns {Promise<Array<string>>} Array of domain strings
 */
export async function getExclusionList() {
  try {
    const result = await chrome.storage.sync.get(['userExclusionList']);
    let userExclusionList = result.userExclusionList;
    
    // Validate that userExclusionList is an array with valid domains
    if (!Array.isArray(userExclusionList) || userExclusionList.length === 0) {
      // Initialize with defaults if empty
      userExclusionList = [...DEFAULT_USER_EXCLUSION_LIST];
    } else {
      // Basic validation: all items should be non-empty strings
      const isValid = userExclusionList.every(domain => 
        typeof domain === 'string' && domain.trim().length > 0
      );
      
      if (!isValid) {
        userExclusionList = [...DEFAULT_USER_EXCLUSION_LIST];
      }
    }
    
    // Combine system and user exclusion lists
    return [...SYSTEM_EXCLUSION_LIST, ...userExclusionList];
  } catch (error) {
    console.error("Failed to get exclusion list from storage:", error);
    return [...SYSTEM_EXCLUSION_LIST, ...DEFAULT_USER_EXCLUSION_LIST];
  }
}

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

