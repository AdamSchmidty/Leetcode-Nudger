# API Documentation

This document provides comprehensive documentation for all exported functions in the Leetcode Buddy extension.

## Table of Contents

1. [Background Modules](#background-modules)
   - [storage.js](#storagejs)
   - [problemLogic.js](#problemlogicjs)
   - [redirects.js](#redirectsjs)
   - [messageHandler.js](#messagehandlerjs)
2. [Content Modules](#content-modules)
   - [api.js](#apijs)
   - [detector.js](#detectorjs)
   - [ui.js](#uijs)
3. [Shared Modules](#shared-modules)
   - [constants.js](#constantsjs)

---

## Background Modules

### storage.js

Storage operations for chrome.storage.sync and chrome.storage.local.

#### `getState()`

Returns current extension state from chrome.storage.sync.

**Returns:** `Promise<Object>`
- `currentCategoryIndex: number` - Current category index (0-based)
- `currentProblemIndex: number` - Current problem index within category
- `solvedProblems: Set<string>` - Set of solved problem slugs
- `selectedProblemSet: string` - Selected problem set name

**Example:**
```javascript
const state = await getState();
console.log(state.currentCategoryIndex); // 0
console.log(state.solvedProblems.has('two-sum')); // true
```

---

#### `saveState(categoryIndex, problemIndex, solvedProblems)`

Saves extension state to chrome.storage.sync.

**Parameters:**
- `categoryIndex: number` - Category index to save
- `problemIndex: number` - Problem index to save
- `solvedProblems: Set<string>` - Set of solved problem slugs

**Returns:** `Promise<void>`

**Example:**
```javascript
await saveState(1, 3, new Set(['two-sum', 'valid-anagram']));
```

---

#### `getDailySolveState()`

Returns daily solve status from chrome.storage.local.

**Returns:** `Promise<Object>`
- `solvedToday: boolean` - Whether problem was solved today
- `lastSolveDate: string` - Last solve date (YYYY-MM-DD)
- `lastSolveTimestamp: number` - Last solve timestamp
- `lastSolveProblem: string` - Last solved problem slug

**Example:**
```javascript
const dailyState = await getDailySolveState();
if (dailyState.solvedToday) {
  console.log('Already solved today:', dailyState.lastSolveProblem);
}
```

---

#### `markDailySolve(problemSlug)`

Marks a problem as solved for today and unblocks all websites.

**Parameters:**
- `problemSlug: string` - Slug of the problem that was solved

**Returns:** `Promise<void>`

**Side Effects:**
- Saves daily solve data to local storage
- Removes redirect rule (unblocks websites)

**Example:**
```javascript
await markDailySolve('two-sum');
// Websites now unblocked until midnight
```

---

#### `clearDailySolve()`

Clears daily solve status from local storage.

**Returns:** `Promise<void>`

**Example:**
```javascript
await clearDailySolve();
// Daily solve status reset
```

---

#### `getBypassState()`

Returns bypass system state.

**Returns:** `Promise<Object>`
- `isActive: boolean` - Whether bypass is currently active
- `remainingMs: number` - Milliseconds remaining on bypass
- `canBypass: boolean` - Whether bypass can be activated
- `nextAllowedMs: number` - Milliseconds until next bypass allowed

**Example:**
```javascript
const bypassState = await getBypassState();
if (bypassState.canBypass) {
  console.log('Bypass available');
} else {
  console.log('Cooldown:', bypassState.nextAllowedMs / 1000, 'seconds');
}
```

---

#### `setBypassState(bypassUntil, nextBypassAllowed)`

Saves bypass timestamps to local storage.

**Parameters:**
- `bypassUntil: number` - Timestamp when bypass expires
- `nextBypassAllowed: number` - Timestamp when next bypass allowed

**Returns:** `Promise<void>`

**Example:**
```javascript
const now = Date.now();
await setBypassState(now + 600000, now + 1800000);
// Bypass for 10 minutes, cooldown for 30 minutes
```

---

#### `clearBypass()`

Clears bypass state from local storage.

**Returns:** `Promise<void>`

**Example:**
```javascript
await clearBypass();
// Bypass state cleared
```

---

### problemLogic.js

Problem set management and progress calculation.

#### `loadProblemSet()`

Loads and caches the problem set from assets.

**Returns:** `Promise<Object|null>`
- Problem set object with categories array
- `null` on error

**Example:**
```javascript
const problemSet = await loadProblemSet();
console.log(problemSet.name); // "NeetCode 250"
console.log(problemSet.categories.length); // 18
```

---

#### `loadAliases()`

Loads and caches problem aliases from assets.

**Returns:** `Promise<Object>`
- Aliases object mapping alias → canonical slug
- Empty object on error

**Example:**
```javascript
const aliases = await loadAliases();
console.log(aliases['best-time-to-buy-and-sell-crypto']);
// "best-time-to-buy-and-sell-stock"
```

---

#### `resolveAlias(slug)`

Resolves a problem slug through the alias map.

**Parameters:**
- `slug: string` - Problem slug (may be alias)

**Returns:** `string`
- Canonical slug if alias exists
- Original slug if no alias

**Example:**
```javascript
const canonical = resolveAlias('best-time-to-buy-and-sell-crypto');
// Returns: "best-time-to-buy-and-sell-stock"

const same = resolveAlias('two-sum');
// Returns: "two-sum"
```

---

#### `fetchAllProblemStatuses()`

Fetches all problem statuses from LeetCode API.

**Returns:** `Promise<Map<string, string|null>>`
- Map of slug → status ("ac" for solved, null for unsolved)
- Empty map on error

**Example:**
```javascript
const statusMap = await fetchAllProblemStatuses();
console.log(statusMap.get('two-sum')); // "ac"
console.log(statusMap.get('unsolved-problem')); // null
```

---

#### `computeNextProblem()`

Computes the next unsolved problem across all categories.

**Returns:** `Promise<Object|null>`
- Problem object with details
- `null` if all problems solved

**Problem Object:**
- `slug: string` - Problem slug
- `id: number` - LeetCode problem ID
- `title: string` - Problem title
- `difficulty: string` - "Easy", "Medium", or "Hard"
- `category: string` - Category name
- `categoryIndex: number` - Category index
- `problemIndex: number` - Problem index within category
- `url: string` - LeetCode problem URL

**Example:**
```javascript
const next = await computeNextProblem();
console.log(next.title); // "Two Sum"
console.log(next.url); // "https://leetcode.com/problems/two-sum/"
```

---

#### `computeCategoryProgress(category, solvedProblems)`

Calculates progress for a single category.

**Parameters:**
- `category: Object` - Category object with problems array
- `solvedProblems: Set<string>` - Set of solved problem slugs

**Returns:** `Object`
- `solved: number` - Number of problems solved
- `total: number` - Total problems in category
- `percentage: number` - Percentage solved (0-100)

**Example:**
```javascript
const category = { problems: [/* ... */] };
const solved = new Set(['two-sum', 'valid-anagram']);
const progress = computeCategoryProgress(category, solved);
console.log(`${progress.solved}/${progress.total} (${progress.percentage}%)`);
```

---

#### `getAllCategoryProgress()`

Calculates progress for all categories.

**Returns:** `Promise<Array<Object>>`
- Array of progress objects, one per category

**Progress Object:**
- `name: string` - Category name
- `solved: number` - Problems solved in category
- `total: number` - Total problems in category
- `percentage: number` - Percentage solved
- `problems: Array<Object>` - Array of problem objects

**Example:**
```javascript
const allProgress = await getAllCategoryProgress();
allProgress.forEach(cat => {
  console.log(`${cat.name}: ${cat.solved}/${cat.total}`);
});
```

---

### redirects.js

Redirect rule management and bypass system.

#### `installRedirectRule()`

Installs or updates the declarativeNetRequest redirect rule.

**Returns:** `Promise<void>`

**Side Effects:**
- Updates dynamic redirect rule in Chrome
- Redirects non-whitelisted sites to current problem

**Example:**
```javascript
await installRedirectRule();
// All non-whitelisted sites now redirect
```

---

#### `removeRedirectRule()`

Removes the redirect rule.

**Returns:** `Promise<void>`

**Side Effects:**
- Removes redirect rule from Chrome
- All websites become accessible

**Example:**
```javascript
await removeRedirectRule();
// All websites now accessible
```

---

#### `checkAndRestoreRedirect()`

Checks if redirect should be restored and restores if needed.

**Returns:** `Promise<void>`

**Logic:**
- If bypass active: Do nothing
- If daily solve active: Do nothing
- Otherwise: Restore redirect rule

**Example:**
```javascript
// Called periodically by background script
await checkAndRestoreRedirect();
```

---

#### `activateBypass()`

Activates 10-minute bypass with cooldown enforcement.

**Returns:** `Promise<Object>`
- `success: boolean` - Whether bypass was activated
- `error: string` - Error message if failed
- `bypassUntil: number` - Timestamp when bypass expires
- `remainingMs: number` - Milliseconds remaining

**Example:**
```javascript
const result = await activateBypass();
if (result.success) {
  console.log('Bypass active for:', result.remainingMs / 1000, 'seconds');
} else {
  console.log('Error:', result.error);
}
```

---

#### `checkDailyReset()`

Checks if day has changed and resets daily solve status.

**Returns:** `Promise<void>`

**Logic:**
- Compares stored date with today's date
- If different: Clears daily solve and restores redirect

**Example:**
```javascript
// Called periodically by background script
await checkDailyReset();
```

---

### messageHandler.js

Message routing and handling for the background script.

#### `setupMessageListener()`

Sets up the message listener for chrome.runtime.onMessage.

**Returns:** `void`

**Example:**
```javascript
// Called once during background script initialization
setupMessageListener();
```

---

#### `handleMessage(message, sender, sendResponse)`

Main message handler that routes messages to specific handlers.

**Parameters:**
- `message: Object` - Message object with `type` property
- `sender: Object` - Chrome message sender object
- `sendResponse: Function` - Callback to send response

**Returns:** `Promise<void>`

**Supported Message Types:**
- `PROBLEM_SOLVED` - Problem was solved
- `GET_STATUS` - Get current status
- `GET_DETAILED_PROGRESS` - Get category progress
- `ACTIVATE_BYPASS` - Activate bypass
- `REFRESH_STATUS` - Refresh from LeetCode
- `RESET_PROGRESS` - Reset all progress

**Example:**
```javascript
// Internal use - called by chrome.runtime.onMessage
```

---

## Content Modules

### api.js

LeetCode API interaction layer for content script.

#### `loadAliases()`

Loads problem aliases from extension resources.

**Returns:** `Promise<Object>`
- Aliases object
- Empty object on error

**Example:**
```javascript
const aliases = await loadAliases();
```

---

#### `resolveAlias(slug)`

Resolves problem alias to canonical slug.

**Parameters:**
- `slug: string` - Problem slug (may be alias)

**Returns:** `string` - Canonical slug

**Example:**
```javascript
const canonical = resolveAlias('some-alias');
```

---

#### `getCurrentSlug()`

Extracts problem slug from current URL.

**Returns:** `string|null`
- Problem slug if on problem page
- `null` if not on problem page

**Example:**
```javascript
// On /problems/two-sum/
const slug = getCurrentSlug(); // "two-sum"

// On /problemset/all/
const slug = getCurrentSlug(); // null
```

---

#### `getCsrfToken()`

Extracts CSRF token from document cookies.

**Returns:** `string|null`
- CSRF token if found
- `null` if not found

**Example:**
```javascript
const token = getCsrfToken();
```

---

#### `getCurrentUsername(retries)`

Fetches current LeetCode username with retry logic.

**Parameters:**
- `retries: number` - Number of retry attempts (default: 2)

**Returns:** `Promise<string|null>`
- Username if successful
- `null` if failed

**Example:**
```javascript
const username = await getCurrentUsername();
if (username) {
  console.log('Logged in as:', username);
}
```

---

#### `queryProblemStatus(slug)`

Queries problem status via GraphQL.

**Parameters:**
- `slug: string` - Problem slug

**Returns:** `Promise<string|null>`
- `"ac"` if solved
- `null` if unsolved or error

**Example:**
```javascript
const status = await queryProblemStatus('two-sum');
if (status === 'ac') {
  console.log('Problem is solved');
}
```

---

#### `queryRecentSubmissions(username, limit)`

Fetches recent submissions for user.

**Parameters:**
- `username: string` - LeetCode username
- `limit: number` - Number of submissions (default: 20)

**Returns:** `Promise<Array<Object>>`
- Array of submission objects
- Empty array on error

**Submission Object:**
- `titleSlug: string`
- `timestamp: string`
- `statusDisplay: string`
- `lang: string`

**Example:**
```javascript
const submissions = await queryRecentSubmissions('user123');
console.log(submissions[0].titleSlug); // "two-sum"
```

---

#### `queryProblemSubmissions(slug)`

Fetches problem-specific submission history.

**Parameters:**
- `slug: string` - Problem slug

**Returns:** `Promise<Object|null>`
- Submission list object
- `null` on error

**Example:**
```javascript
const submissions = await queryProblemSubmissions('two-sum');
```

---

#### `isSolvedToday(timestamp)`

Checks if timestamp is from today (local timezone).

**Parameters:**
- `timestamp: number` - Unix timestamp in seconds

**Returns:** `boolean`
- `true` if timestamp is from today
- `false` otherwise

**Example:**
```javascript
const todayTimestamp = Math.floor(Date.now() / 1000);
console.log(isSolvedToday(todayTimestamp)); // true

const yesterdayTimestamp = todayTimestamp - 86400;
console.log(isSolvedToday(yesterdayTimestamp)); // false
```

---

### detector.js

Problem solve detection and verification.

#### `sendMessageSafely(message)`

Safely sends message to background script with context validation.

**Parameters:**
- `message: Object` - Message to send

**Returns:** `Promise<Object>`
- Response from background script
- Error response if context invalidated

**Example:**
```javascript
const response = await sendMessageSafely({
  type: 'PROBLEM_SOLVED',
  slug: 'two-sum'
});
```

---

#### `checkAndNotify()`

Checks if current problem is solved and notifies background.

**Returns:** `Promise<void>`

**Logic:**
1. Extracts slug from URL
2. Queries problem status
3. Verifies solve date (today vs. past)
4. Checks if expected problem
5. Notifies background if valid

**Example:**
```javascript
// Called automatically by content script
await checkAndNotify();
```

---

### ui.js

UI feedback and visual elements.

#### `checkIfShouldShowCelebration()`

Checks if celebration should be shown (once per day, if enabled).

**Returns:** `Promise<boolean>`
- `true` if should show
- `false` otherwise

**Example:**
```javascript
const shouldShow = await checkIfShouldShowCelebration();
if (shouldShow) {
  triggerConfetti();
}
```

---

#### `markCelebrationAsShown()`

Marks celebration as shown for today.

**Returns:** `Promise<void>`

**Example:**
```javascript
await markCelebrationAsShown();
// Won't show again today
```

---

#### `triggerConfetti()`

Creates CSS-based confetti animation.

**Returns:** `void`

**Side Effects:**
- Adds confetti container to DOM
- Auto-removes after 4 seconds

**Example:**
```javascript
triggerConfetti();
// Confetti animation plays
```

---

#### `showSolvedNotification()`

Shows success notification when problem is solved.

**Returns:** `Promise<void>`

**Side Effects:**
- Shows confetti (if enabled and not shown today)
- Shows notification banner
- Auto-removes after 5 seconds

**Example:**
```javascript
await showSolvedNotification();
// Shows celebration and notification
```

---

## Shared Modules

### constants.js

Shared constants used across the extension.

#### Exports

```javascript
export const WHITELIST = [
  "leetcode.com",
  "neetcode.io",
  "chatgpt.com",
  "accounts.google.com",
  "github.com",
  "www.linkedin.com"
];

export const REDIRECT_RULE_ID = 1000;
export const BYPASS_DURATION_MS = 10 * 60 * 1000; // 10 minutes
export const COOLDOWN_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export const PROBLEM_SET_PATH = "src/assets/data/neetcode250.json";
export const ALIASES_PATH = "src/assets/data/problemAliases.json";
```

**Usage:**
```javascript
import { WHITELIST, BYPASS_DURATION_MS } from '../shared/constants.js';

console.log('Whitelist:', WHITELIST);
console.log('Bypass duration:', BYPASS_DURATION_MS / 1000, 'seconds');
```

---

## Message Protocol

### Message Types

All messages follow this structure:

```javascript
{
  type: 'MESSAGE_TYPE',
  // ... additional properties
}
```

### PROBLEM_SOLVED

Sent from content script to background when problem is solved.

**Request:**
```javascript
{
  type: 'PROBLEM_SOLVED',
  slug: 'two-sum',
  timestamp: 1234567890,
  verifiedToday: true
}
```

**Response:**
```javascript
{
  success: true,
  dailySolved: true,
  nextProblem: { slug: 'valid-anagram', title: 'Valid Anagram' }
}
```

### GET_STATUS

Get current extension status.

**Request:**
```javascript
{
  type: 'GET_STATUS'
}
```

**Response:**
```javascript
{
  success: true,
  currentProblem: { slug: 'two-sum', title: 'Two Sum', url: '...' },
  totalSolved: 5,
  totalProblems: 250,
  dailySolved: true
}
```

### GET_DETAILED_PROGRESS

Get detailed category-wise progress.

**Request:**
```javascript
{
  type: 'GET_DETAILED_PROGRESS'
}
```

**Response:**
```javascript
{
  success: true,
  categories: [
    { name: 'Arrays & Hashing', solved: 5, total: 10, percentage: 50, problems: [...] }
  ]
}
```

---

## Error Handling

All async functions return sensible defaults on error:

- Functions returning objects: Return `null`
- Functions returning arrays: Return `[]`
- Functions returning maps: Return `new Map()`
- Functions returning sets: Return `new Set()`

Errors are logged to console for debugging.


