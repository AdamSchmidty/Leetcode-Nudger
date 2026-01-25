// ============================================================================
// LEETCODE BUDDY - BACKGROUND SERVICE WORKER (Main Entry Point)
// ============================================================================
// Orchestrates all background modules and handles extension lifecycle
// ============================================================================

import { loadAliases, computeNextProblem } from './problemLogic.js';
import { installRedirectRule, checkDailyReset, checkAndRestoreRedirect } from './redirects.js';
import { setupMessageListener } from './messageHandler.js';

console.log("Leetcode Buddy - Background Service Worker Starting");

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Leetcode Buddy installed");
  await loadAliases();
  // On first install, sync all solved problems from LeetCode
  await computeNextProblem(true);
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

// Set up message listener
setupMessageListener();

// Periodic checks (every minute)
// Check for daily reset and restore redirects if bypass/daily solve expired
setInterval(async () => {
  await checkDailyReset();
  await checkAndRestoreRedirect();
}, 60 * 1000);

console.log("Leetcode Buddy - Background Service Worker Ready");

