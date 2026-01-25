# 🤝 Leetcode Buddy

Your daily LeetCode companion! A Chrome extension that helps you stay focused and complete coding problem sets by restricting access to non-whitelisted websites until you solve your daily problem.

## Features

- ✅ **Automatic Problem Tracking**: Detects when you solve problems on LeetCode and automatically advances to the next one
- 🚫 **Website Blocking**: Redirects non-whitelisted websites to your current problem until you solve it
- 🎯 **Multiple Problem Sets**: Choose from Blind 75, NeetCode 150, NeetCode 250, or NeetCode All
- 🎲 **Random Problem Selection**: Option to randomly select from unsolved problems instead of going in sequence
- 📊 **Progress Tracking**: Visual progress bars showing your progress overall and by category
- ⏱️ **Timed Bypass**: Take a 10-minute break when needed (30-minute cooldown)
- 🔄 **Auto-Sync**: Automatically syncs with your LeetCode account status
- 🎉 **Celebrations**: Optional confetti animations when you solve your daily problem
- ⚙️ **Customizable Exclusions**: Add up to 10 websites to exclude from redirection

## Installation

### Step 1: Load the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `leetcodeForcer` folder
5. The extension should now appear in your extensions list

### Step 2: Log in to LeetCode

1. Navigate to [leetcode.com](https://leetcode.com/)
2. Log in to your LeetCode account
3. The extension will automatically sync your solved problems

### Step 3: Configure Settings (Optional)

1. Right-click the extension icon and select **Options** (or click the ⚙️ Settings button in the popup)
2. Choose your preferred problem set (Blind 75, NeetCode 150, NeetCode 250, or NeetCode All)
3. Customize your preferences (see [Settings & Configuration](#settings--configuration) below)

### Step 4: Start Grinding!

Once installed, the extension will:
- Redirect all non-whitelisted websites to your current problem
- Track your progress automatically
- Update to the next problem when you solve the current one
- Unblock all websites after you solve your daily problem (until midnight)

## How to Use

### View Your Progress

Click the extension icon in your Chrome toolbar to see:
- **Overall Progress**: Total problems solved with a visual progress bar
- **Current Problem**: The problem you need to solve next, with direct links to LeetCode and NeetCode video solutions
- **Category Progress**: Breakdown of solved problems by category
- **Daily Status**: Whether you've completed today's problem

### Solve Your Daily Problem

1. The extension automatically redirects you to your current problem when you try to visit non-whitelisted sites
2. Work on the problem on LeetCode
3. Submit your solution
4. Once your submission is marked as "Accepted", the extension will:
   - Show a celebration animation (if enabled)
   - Mark the problem as solved
   - Advance to the next problem
   - Unblock all websites until midnight

### Take a Break

When you need a breather:

1. Click the extension icon
2. Click **"Start Break (10 min)"**
3. You'll have 10 minutes of unrestricted browsing
4. After the break, the redirect automatically resumes
5. You can take another break after a 30-minute cooldown

### Refresh Your Status

If you've solved problems outside the extension or want to force a sync:

1. Click the extension icon
2. Click **"🔄 Refresh Status"**
3. The extension will query LeetCode for your latest progress and update accordingly

### Access Settings

1. Click the extension icon
2. Click **"⚙️ Settings"** to open the options page
3. Configure your preferences (see [Settings & Configuration](#settings--configuration) below)

## Settings & Configuration

Access settings by right-clicking the extension icon and selecting **Options**, or click the ⚙️ Settings button in the popup.

### Problem Set Selection

Choose which problem set you want to work through:
- **Blind 75**: The classic 75 essential problems
- **NeetCode 150**: 150 curated problems
- **NeetCode 250**: 250 problems organized by category
- **NeetCode All**: Comprehensive collection of all NeetCode problems

### Display Preferences

- **Celebration Animations**: Toggle confetti and celebration animations when you solve your daily problem
- **Sort Problems by Difficulty**: Sort problems within each category by difficulty (Easy → Medium → Hard) instead of the original problemset order
- **Random Problem Selection**: Select problems randomly from unsolved problems instead of going in sequence
- **Clear Editor on First Open** (Experimental): Clear the code editor content when you first open a problem each day. Subsequent refreshes will preserve your work.

### Exclusion List

Customize which websites are excluded from redirection:

- **System Domains** (Always Excluded): These domains are required for the extension to function:
  - `leetcode.com` - Solve problems
  - `neetcode.io` - View problem lists and solutions
  - `accounts.google.com` - Google OAuth authentication

- **Your Custom Domains**: Add up to 10 additional websites to exclude from redirection:
  1. Enter a domain (e.g., `github.com`) in the input field
  2. Click **"Add Domain"**
  3. Remove domains by clicking the × button next to them
  4. Click **"Reset to Defaults"** to restore default exclusions (GitHub, LinkedIn)

### Category Progress

View all problems organized by category with visual progress indicators. Click categories to expand and see individual problems and their status.

### Reset Progress

If you want to start fresh:
1. Scroll to the **Reset Progress** section
2. Click **"Reset All Progress"**
3. Confirm the action (this cannot be undone)

## Troubleshooting

### Extension Not Redirecting

1. Make sure you're logged in to LeetCode
2. Check that the extension is enabled in `chrome://extensions/`
3. Verify that you haven't already solved today's problem (websites are unblocked after solving)
4. Try clicking **"🔄 Refresh Status"** in the extension popup
5. Check the exclusion list in settings to ensure the site isn't excluded

### Problem Not Advancing

1. Ensure your submission is marked as "Accepted" on LeetCode
2. Wait a few seconds for the extension to detect the change
3. Try refreshing the LeetCode problem page
4. Click **"🔄 Refresh Status"** in the extension popup
5. Check the browser console for any error messages

### Can't Access Excluded Sites

1. Check your internet connection
2. Make sure the sites are using `https://`
3. Verify the domain is in your exclusion list (Settings → Exclusion List)
4. Try disabling and re-enabling the extension

### Progress Not Syncing

1. Make sure you're logged in to LeetCode
2. Click **"🔄 Refresh Status"** in the extension popup
3. Check that Chrome sync is enabled (for cross-device sync)
4. Verify your LeetCode account has the problems marked as solved

### Celebration Not Showing

1. Check Settings → Display Preferences → Celebration Animations is enabled
2. Make sure you're solving the expected problem (not a different one)
3. Verify the problem was solved today (not in the past)

---

## Architecture

Leetcode Buddy uses a modular architecture with ES6 modules for better maintainability and testability:

### Background Script (5 modules)
- `src/background/index.js` - Main entry point & lifecycle management
- `src/background/storage.js` - Chrome storage operations
- `src/background/problemLogic.js` - Problem set management & progress calculation
- `src/background/redirects.js` - Redirect rules & bypass functionality
- `src/background/messageHandler.js` - Message routing & handlers

### Content Script (4 modules)
- `src/content/index.js` - Main entry point & DOM observation
- `src/content/api.js` - LeetCode API layer
- `src/content/detector.js` - Problem solve detection logic with optimization guards
- `src/content/ui.js` - Celebrations & notifications

### Shared
- `src/shared/constants.js` - Shared constants across modules

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed technical documentation.

## Project Structure

```
leetcodeForcer/
├── manifest.json           # Extension configuration
├── src/
│   ├── background/         # Background service worker modules
│   │   ├── index.js
│   │   ├── storage.js
│   │   ├── problemLogic.js
│   │   ├── redirects.js
│   │   └── messageHandler.js
│   ├── content/            # Content script modules
│   │   ├── index.js
│   │   ├── api.js
│   │   ├── detector.js
│   │   ├── editor.js
│   │   └── ui.js
│   ├── shared/             # Shared constants
│   │   └── constants.js
│   └── assets/             # Icons, data, styles
│       ├── icons/
│       ├── data/
│       │   ├── blind75.json
│       │   ├── neetcode150.json
│       │   ├── neetcode250.json
│       │   ├── neetcodeAll.json
│       │   └── problemAliases.json
│       └── styles/
├── tests/                  # Unit and integration tests
│   ├── background/
│   ├── content/
│   └── integration/
├── docs/                   # Documentation
├── popup.html/js/css       # Extension popup
├── options.html/js/css     # Extension options
└── package.json            # Node dependencies
```

## Technical Details

### How It Works

#### Website Blocking

The extension uses Chrome's `declarativeNetRequest` API to redirect all navigation to non-excluded websites. The exclusion list consists of:
- System-enforced domains (LeetCode, NeetCode, Google OAuth) - always excluded
- User-defined domains (up to 10 custom domains) - configurable in settings

#### Automatic Problem Detection

When you're on a LeetCode problem page, the content script:

1. Monitors the page for successful submission indicators (DOM mutations)
2. Queries LeetCode's GraphQL API to confirm the problem status
3. Verifies the submission was made today (not in the past)
4. Checks that it's the expected problem (not a different one)
5. Notifies the background service worker when status is "Accepted"
6. Automatically advances to the next problem in the list
7. Optimizes by skipping redundant checks once a problem is confirmed solved today

#### Progress Tracking

Your progress is stored in Chrome's sync storage and automatically backed up across devices. The extension:

- Tracks which problems you've solved (stored as problem slugs)
- Maintains your current position in the selected problem set
- Syncs with LeetCode's API on startup and when manually refreshed
- Tracks daily solve status (resets at midnight)

### Permissions

The extension requires:

- `storage` - Store progress and settings
- `declarativeNetRequest` - Implement website blocking/redirecting
- `host_permissions` - Access LeetCode API and all URLs for redirection

### APIs Used

- **LeetCode GraphQL API**: Check problem solve status and fetch submission history
  - Endpoint: `https://leetcode.com/graphql`
  - Queries: `questionStatus`, `recentSubmissionList`, `submissionList`, `globalData`
- **LeetCode Problems API**: Bulk fetch all problem statuses
  - Endpoint: `https://leetcode.com/api/problems/all/`

### Storage

- `chrome.storage.sync`:
  - `currentProblemSlug` - Current problem slug
  - `categoryIndex` - Current category index
  - `problemIndex` - Current problem index within category
  - `solvedProblems` - Array of solved problem slugs
  - `activeProblemSet` - Selected problem set ID
  - `userExclusionList` - User-defined exclusion domains
  - `randomProblemSelection` - Random selection toggle
  - `sortByDifficulty` - Sort by difficulty toggle
  - `clearEditorOnFirstOpen` - Clear editor toggle
  - `celebrationEnabled` - Celebration animations toggle

- `chrome.storage.local`:
  - `bypassUntil` - Timestamp when bypass expires
  - `nextBypassAllowed` - Timestamp when next bypass can be activated
  - `dailySolveDate` - Date when daily problem was solved (YYYY-MM-DD)
  - `dailySolveProblem` - Slug of the problem solved today
  - `problemFirstOpened_*` - Per-problem first-open tracking for editor clearing

## Development

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Load extension in Chrome (Developer Mode)
4. Make your changes

### Running Tests

The project includes comprehensive unit and integration tests:

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Test Coverage Goals:**
- 80%+ line coverage
- 80%+ branch coverage
- 80%+ function coverage

See [docs/TESTING.md](docs/TESTING.md) for detailed testing guide.

### Manual Testing

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

### Debugging

- **Background Script**: `chrome://extensions/` → Click "service worker" under the extension
- **Content Script**: Open DevTools on any LeetCode problem page
- **Popup**: Right-click the extension icon → "Inspect popup"
- **Options Page**: Right-click the extension icon → "Options" → Open DevTools

### Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines and best practices.

## Customization

### Add More Excluded Sites

Use the Settings page (Options → Exclusion List) to add up to 10 custom domains. For system-level changes, edit `src/shared/constants.js`:

```javascript
export const DEFAULT_USER_EXCLUSION_LIST = [
  "github.com",
  "linkedin.com",
  "your-site.com",
];
```

### Change Bypass Duration

Edit `src/shared/constants.js`:

```javascript
export const BYPASS_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const COOLDOWN_DURATION_MS = 60 * 60 * 1000; // 60 minutes
```

### Update Problem Lists

Problem sets are stored in JSON format in `src/assets/data/`:
- `blind75.json`
- `neetcode150.json`
- `neetcode250.json`
- `neetcodeAll.json`

Each file contains an array of categories, with each category containing an array of problems with properties: `slug`, `leetcodeId`, `title`, `difficulty`, `category`.

### Modify Problem Aliases

Edit `src/assets/data/problemAliases.json` to add or modify problem slug aliases for better matching.

## License

MIT License - Feel free to modify and distribute

## Credits

- NeetCode problem lists curated by [NeetCode](https://neetcode.io/)
- Built with Chrome Extension Manifest V3

---

**Good luck with your grinding! 💪**

Remember: The only way out is through. Stay focused and you'll complete all your problems!
