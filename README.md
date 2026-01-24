# 🤝 Leetcode Buddy

Your daily LeetCode companion! A Chrome extension that helps you complete the NeetCode 250 problem list in order by restricting access to non-whitelisted websites until you solve the current problem.

## Features

- ✅ **Automatic Problem Tracking**: Detects when you solve problems on LeetCode
- 🚫 **Website Blocking**: Blocks all websites except neetcode.io, leetcode.com, and chatgpt.com
- 🎯 **Enforced Order**: Redirects you to the next unsolved problem in the NeetCode 250 list
- ⏱️ **Timed Bypass**: Take a 10-minute break when needed (30-minute cooldown)
- 📊 **Progress Tracking**: Visual progress bar showing how many problems you've solved
- 🔄 **Auto-Sync**: Automatically syncs with your LeetCode account status

## Installation

### Step 1: Load the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `leetcodeForcer` folder
5. The extension should now appear in your extensions list

### Step 2: Log in to LeetCode

1. Navigate to [leetcode.com](https://leetcode.com/)
2. Log in to your account (adamschmidt2023)
3. The extension will automatically sync your solved problems

### Step 3: Start Grinding!

Once installed, the extension will:

- Redirect all non-whitelisted websites to your current NeetCode 250 problem
- Track your progress automatically
- Update to the next problem when you solve the current one

## How It Works

### Website Blocking

The extension uses Chrome's `declarativeNetRequest` API to redirect all navigation to non-whitelisted websites. Only these domains are allowed:

- `neetcode.io` - View the NeetCode 250 list
- `leetcode.com` - Solve problems
- `chatgpt.com` - Get help when stuck

### Automatic Problem Detection

When you're on a LeetCode problem page, the content script:

1. Monitors the page for successful submission indicators
2. Queries LeetCode's GraphQL API to confirm the problem status
3. Notifies the background service worker when status is "Accepted"
4. Automatically advances to the next problem in the list

### Progress Tracking

Your progress is stored in Chrome's sync storage and automatically backed up across devices. The extension:

- Tracks which problems you've solved
- Maintains your current position in the NeetCode 250 list
- Syncs with LeetCode's API on startup to ensure accuracy

## Using the Extension

### View Progress

Click the extension icon in your Chrome toolbar to see:

- Total problems solved (X / 250)
- Current problem name and link
- Visual progress bar

### Take a Break

When you need a breather:

1. Click the extension icon
2. Click **"Start Break (10 min)"**
3. You'll have 10 minutes of unrestricted browsing
4. After the break, the redirect automatically resumes
5. You can take another break after a 30-minute cooldown

### Refresh Status

If you've solved problems outside the extension or want to force a sync:

1. Click the extension icon
2. Click **"🔄 Refresh Status"**
3. The extension will query LeetCode for your latest progress

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
- `src/content/detector.js` - Problem solve detection logic
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
│   │   └── ui.js
│   ├── shared/             # Shared constants
│   │   └── constants.js
│   └── assets/             # Icons, data, styles
│       ├── icons/
│       ├── data/
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

### Permissions

The extension requires:

- `storage` - Store progress and settings
- `declarativeNetRequest` - Implement website blocking/redirecting
- `host_permissions` - Access LeetCode API and all URLs for redirection

### APIs Used

- **LeetCode GraphQL API**: Check problem solve status
  - Endpoint: `https://leetcode.com/graphql`
  - Query: `question(titleSlug: $slug) { status }`
- **LeetCode Problems API**: Bulk fetch all problem statuses
  - Endpoint: `https://leetcode.com/api/problems/all/`

### Storage

- `chrome.storage.sync`:

  - `currentIndex` - Current position in NeetCode 250 list
  - `solvedProblems` - Array of solved problem slugs

- `chrome.storage.local`:
  - `bypassUntil` - Timestamp when bypass expires
  - `nextBypassAllowed` - Timestamp when next bypass can be activated

## Troubleshooting

### Extension Not Redirecting

1. Make sure you're logged in to LeetCode
2. Check that the extension is enabled in `chrome://extensions/`
3. Try clicking "Refresh Status" in the extension popup

### Problem Not Advancing

1. Ensure your submission is marked as "Accepted" on LeetCode
2. Wait a few seconds for the extension to detect the change
3. Try refreshing the LeetCode problem page
4. Click "Refresh Status" in the extension popup

### Can't Access Whitelisted Sites

1. Check your internet connection
2. Make sure the sites are using `https://`
3. Try disabling and re-enabling the extension

## Customization

### Add More Whitelisted Sites

Edit `src/shared/constants.js`:

```javascript
export const WHITELIST = [
  "leetcode.com",
  "neetcode.io",
  "chatgpt.com",
  "your-site.com",
];
```

### Change Bypass Duration

Edit `src/shared/constants.js`:

```javascript
export const BYPASS_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const COOLDOWN_DURATION_MS = 60 * 60 * 1000; // 60 minutes
```

### Update Problem List

Replace `src/assets/data/neetcode250.json` with your custom problem list organized by categories.

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

### Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines and best practices.

## License

MIT License - Feel free to modify and distribute

## Credits

- NeetCode 250 problem list curated by [NeetCode](https://neetcode.io/)
- Built with Chrome Extension Manifest V3

---

**Good luck with your grinding! 💪**

Remember: The only way out is through. Stay focused and you'll complete all 250 problems!

