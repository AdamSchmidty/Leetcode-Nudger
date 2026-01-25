// ============================================================================
// LEETCODE BUDDY - CONTENT API MODULE
// ============================================================================
// All LeetCode API interactions, authentication, and data fetching
// ============================================================================

import { ALIASES_PATH } from '../shared/constants.js';

// In-memory cache
let aliases = {};

/**
 * Load problem aliases mapping from assets
 * @returns {Promise<Object>} Aliases object
 */
export async function loadAliases() {
  try {
    const response = await fetch(chrome.runtime.getURL(ALIASES_PATH));
    aliases = await response.json();
    console.log("Problem aliases loaded:", Object.keys(aliases).length);
    return aliases;
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
export function resolveAlias(slug) {
  return aliases[slug] || slug;
}

/**
 * Get current problem slug from URL
 * @returns {string|null} Problem slug or null
 */
export function getCurrentSlug() {
  const match = window.location.pathname.match(/^\/problems\/([^/]+)\/?/);
  return match ? match[1] : null;
}

/**
 * Get CSRF token from cookies
 * @returns {string} CSRF token or empty string
 */
export function getCsrfToken() {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : "";
}

/**
 * Get current LeetCode username with retry logic
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<string|null>} Username or null
 */
export async function getCurrentUsername(retries = 2) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // First, try to get username from the page's global data
      const globalData = document.querySelector('script')?.textContent?.match(/username['"]\s*:\s*['"]([^'"]+)['"]/);
      if (globalData && globalData[1]) {
        console.log("✓ Username found in page data:", globalData[1]);
        return globalData[1];
      }

      // Alternative: Query the whoami endpoint
      const query = `
        query globalData {
          userStatus {
            username
          }
        }
      `;

      const response = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrftoken": getCsrfToken(),
          Referer: window.location.href,
        },
        credentials: "include",
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const username = data?.data?.userStatus?.username;
      
      if (username) {
        console.log("✓ Username fetched from API:", username);
        return username;
      }
      
      // If no username found, throw to trigger retry
      throw new Error("Username not found in response");
      
    } catch (error) {
      console.error(`Username fetch attempt ${attempt + 1}/${retries} failed:`, error.message);
      
      if (attempt < retries - 1) {
        // Wait before retry (exponential backoff)
        const delay = 1000 * (attempt + 1);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.warn("⚠ Failed to get username after all retries, using fallback");
  return null;
}

/**
 * Query LeetCode GraphQL API for problem status
 * @param {string} slug - Problem slug
 * @returns {Promise<string|null>} Status or null
 */
export async function queryProblemStatus(slug) {
  try {
    const query = `
      query questionStatus($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          status
        }
      }
    `;

    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrftoken": getCsrfToken(),
        Referer: window.location.href,
      },
      credentials: "include",
      body: JSON.stringify({
        query,
        variables: { titleSlug: slug },
      }),
    });

    const data = await response.json();
    return data?.data?.question?.status || null;
  } catch (error) {
    console.error("Failed to query problem status:", error);
    return null;
  }
}

/**
 * Query recent submissions with timestamps
 * @param {string} username - LeetCode username
 * @param {number} limit - Number of submissions to fetch
 * @returns {Promise<Array>} Array of submission objects
 */
export async function queryRecentSubmissions(username, limit = 50) {
  try {
    const query = `
      query recentSubmissionList($username: String!, $limit: Int!) {
        recentSubmissionList(username: $username, limit: $limit) {
          titleSlug
          timestamp
          statusDisplay
          lang
        }
      }
    `;

    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrftoken": getCsrfToken(),
        Referer: window.location.href,
      },
      credentials: "include",
      body: JSON.stringify({
        query,
        variables: { username, limit },
      }),
    });

    const data = await response.json();
    return data?.data?.recentSubmissionList || [];
  } catch (error) {
    console.error("Failed to query recent submissions:", error);
    return [];
  }
}

/**
 * Query submission history for a specific problem
 * @param {string} questionSlug - Problem slug
 * @param {number} limit - Number of submissions to fetch
 * @returns {Promise<Array>} Array of submission objects
 */
export async function queryProblemSubmissions(questionSlug, limit = 10) {
  try {
    const query = `
      query submissionList($offset: Int!, $limit: Int!, $questionSlug: String!) {
        submissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
          submissions {
            timestamp
            statusDisplay
            lang
          }
        }
      }
    `;

    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrftoken": getCsrfToken(),
        Referer: window.location.href,
      },
      credentials: "include",
      body: JSON.stringify({
        query,
        variables: { offset: 0, limit, questionSlug },
      }),
    });

    const data = await response.json();
    return data?.data?.submissionList?.submissions || [];
  } catch (error) {
    console.error("Failed to query problem submissions:", error);
    return [];
  }
}

/**
 * Check if a timestamp is from today (local timezone)
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {boolean} True if timestamp is from today
 */
export function isSolvedToday(timestamp) {
  if (!timestamp) return false;
  
  // Convert epoch seconds to Date
  const submissionDate = new Date(parseInt(timestamp) * 1000);
  const today = new Date();
  
  // Compare dates (ignore time)
  return (
    submissionDate.getFullYear() === today.getFullYear() &&
    submissionDate.getMonth() === today.getMonth() &&
    submissionDate.getDate() === today.getDate()
  );
}


