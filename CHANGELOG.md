# Changelog - NeetCode 250 Enforcer v2.0.0

## Major Changes

### 1. Category Organization
- **Reorganized problem list into 18 categories** matching NeetCode's structure:
  - Arrays & Hashing
  - Two Pointers
  - Stack
  - Binary Search
  - Sliding Window
  - Linked List
  - Trees
  - Tries
  - Heaps / Priority Queues
  - Backtracking
  - Graphs
  - Advanced Graphs
  - 1-D Dynamic Programming
  - 2-D Dynamic Programming
  - Greedy
  - Intervals
  - Math & Geometry
  - Bit Manipulation

- Each problem now includes:
  - `slug`: LeetCode problem slug
  - `leetcodeId`: Problem ID number
  - `title`: Full problem title
  - `difficulty`: Easy/Medium/Hard

### 2. Daily Solve System
- **One problem per day unlocks all websites until midnight**
- After solving the daily problem:
  - All non-whitelisted websites are unblocked
  - Redirects are disabled until midnight local time
  - Visual notification appears on LeetCode
  - Green banner shows in popup

- **Automatic daily reset at midnight**:
  - Extension checks every minute for day change
  - At midnight local time, redirects are restored
  - Daily solve status resets automatically
  - Next problem becomes the target

### 3. Enhanced Statistics Display

#### Popup UI
- **Overall Progress Bar**: Shows X/250 problems solved
- **Category Progress Section**: 
  - Individual progress bars for each category
  - Shows solved/total for each category
  - Expandable view (first 5 categories shown, "Show All" button for rest)
  - Color-coded progress indicators

- **Current Problem Display**:
  - Category name
  - Problem title
  - Difficulty badge (color-coded)
  - Direct link to LeetCode

- **Daily Status Indicator**:
  - Green banner when daily problem is solved
  - Shows time until midnight reset

#### Options Page
- Problem set selector dropdown (currently only NeetCode 250)
- Statistics summary (total problems, categories, your progress)
- Reset progress button with confirmation
- Links to NeetCode and LeetCode

### 4. Problem Alias Mapping
- Created `problemAliases.json` for handling name variations
- Resolves aliases before checking LeetCode API
- Example: `buy-and-sell-crypto` → `best-time-to-buy-and-sell-stock`
- Aliases resolved in both background and content scripts

### 5. Storage Schema Updates

#### Chrome Storage Sync
- `solvedProblems`: Array of solved problem slugs
- `currentCategoryIndex`: Current category position (0-17)
- `currentProblemIndex`: Current problem position within category
- `selectedProblemSet`: Selected problem set ID (default: "neetcode250")

#### Chrome Storage Local
- `dailySolveDate`: Date string (YYYY-MM-DD) of last solve
- `dailySolveTimestamp`: Timestamp of last solve
- `bypassUntil`: Bypass expiration timestamp
- `nextBypassAllowed`: Next bypass available timestamp

### 6. New Files

#### Data Files
- `neetcode250.json` - Restructured with 18 categories and 250+ problems
- `problemAliases.json` - Problem name alias mappings

#### Options Page
- `options.html` - Settings page UI
- `options.js` - Settings page logic
- `options.css` - Settings page styling

### 7. Updated Files

#### Core Logic
- `background.js` - Complete rewrite for:
  - Category-based problem navigation
  - Daily solve tracking and reset
  - Midnight detection (local timezone)
  - Alias resolution
  - Category progress calculation
  - Automatic redirect management

#### UI Components
- `popup.html` - Added:
  - Daily status banner
  - Category progress section
  - Difficulty badges
  - Settings button

- `popup.js` - Enhanced with:
  - Category progress rendering
  - Daily status display
  - Expandable category view
  - Settings page navigation

- `popup.css` - New styles for:
  - Category progress bars
  - Daily status banner
  - Difficulty badges
  - Improved layout and scrolling

#### Detection
- `content.js` - Updated to:
  - Load and use alias mappings
  - Resolve aliases before status check
  - Show in-page notification on solve
  - Support new data structure

#### Configuration
- `manifest.json` - Updated with:
  - Version 2.0.0
  - Options page declaration
  - problemAliases.json as web accessible resource
  - Updated description

## Features Summary

### ✅ What Works
- ✅ Category-organized problem list (18 categories, 250+ problems)
- ✅ Daily solve tracking (one per day)
- ✅ Automatic website unlocking after daily solve
- ✅ Midnight reset (local timezone)
- ✅ Category and overall progress statistics
- ✅ Visual progress bars for each category
- ✅ Problem alias resolution
- ✅ Expandable category view in popup
- ✅ Color-coded difficulty badges
- ✅ In-page solve notifications
- ✅ Options/settings page
- ✅ Progress reset functionality
- ✅ Timed bypass system (10 min break, 30 min cooldown)
- ✅ Auto-detection of solved problems from LeetCode API

### 🔄 How It Works

1. **Starting Fresh**:
   - Extension loads NeetCode 250 problem list organized by category
   - Queries LeetCode API for your solved problems
   - Finds first unsolved problem across all categories
   - Installs redirect rule to that problem

2. **Daily Workflow**:
   - Navigate to current problem on LeetCode
   - Solve the problem
   - Extension detects successful submission
   - Marks daily solve complete
   - **All websites unblocked until midnight**
   - Notification appears confirming unlock

3. **Next Day**:
   - At midnight local time, daily status resets
   - Redirects restore automatically
   - Next unsolved problem becomes target
   - Process repeats

4. **Progress Tracking**:
   - Popup shows overall progress (X/250)
   - Category progress bars update as you solve
   - Can expand to see all 18 categories
   - Options page shows detailed statistics

## Testing Checklist

- [x] Category structure loads correctly
- [x] Daily solve tracking works
- [x] Websites unblock after solving problem
- [x] Daily reset works at midnight
- [x] Statistics display correctly (overall + per category)
- [x] Problem set dropdown exists
- [x] Alias mapping resolves correctly
- [x] Progress bars update correctly
- [x] Redirects restore after midnight
- [x] Timed bypass still works
- [x] Options page accessible
- [x] Settings persist across sessions

## Installation Notes

1. Reload the extension in `chrome://extensions/`
2. First load will query LeetCode API for your solved problems
3. May take a few seconds to compute first unsolved problem
4. Check popup to see current problem and statistics
5. Visit options page to see detailed settings

## Migration from v1.0

- No manual migration needed
- Existing solved problems will be detected automatically
- Progress will be computed on first load
- Daily solve starts fresh (no previous day data)

## Known Limitations

- Requires active LeetCode session for API queries
- Alias mappings must be maintained manually
- Only supports NeetCode 250 list currently
- Daily reset tied to local timezone (may differ across devices)

## Future Enhancements

- Multiple problem set support (Blind 75, Grind 169, etc.)
- Custom problem list import
- Detailed statistics dashboard
- Problem solve time tracking
- Streak counter
- Export/import progress

