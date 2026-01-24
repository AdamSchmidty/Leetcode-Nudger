# Contributing to Leetcode Buddy

Thank you for your interest in contributing to Leetcode Buddy! This document provides guidelines and best practices for development.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Code Organization](#code-organization)
4. [Code Style](#code-style)
5. [Testing](#testing)
6. [Pull Request Process](#pull-request-process)
7. [Module Guidelines](#module-guidelines)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Google Chrome (for testing)
- Basic understanding of Chrome Extension APIs
- Familiarity with ES6+ JavaScript

### First-Time Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd leetcodeForcer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Load extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the project directory

4. **Run tests to verify setup**
   ```bash
   npm test
   ```

## Development Setup

### Project Structure

```
leetcodeForcer/
├── src/
│   ├── background/       # Background service worker modules
│   │   ├── index.js      # Entry point
│   │   ├── storage.js    # Storage operations
│   │   ├── problemLogic.js  # Problem management
│   │   ├── redirects.js  # Redirect rules & bypass
│   │   └── messageHandler.js  # Message routing
│   ├── content/          # Content script modules
│   │   ├── index.js      # Entry point
│   │   ├── api.js        # LeetCode API layer
│   │   ├── detector.js   # Detection logic
│   │   └── ui.js         # UI feedback
│   ├── shared/           # Shared constants
│   │   └── constants.js
│   └── assets/           # Icons, data, styles
├── tests/                # Test files
├── docs/                 # Documentation
├── popup.html/js/css     # Extension popup
├── options.html/js/css   # Extension options
└── manifest.json         # Extension manifest
```

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Write code following our style guide
   - Add/update tests
   - Update documentation if needed

3. **Test your changes**
   ```bash
   npm test
   npm run test:coverage
   ```

4. **Reload extension in Chrome**
   - Go to `chrome://extensions/`
   - Click refresh icon on Leetcode Buddy card
   - Test manually

5. **Commit with clear message**
   ```bash
   git commit -m "feat: add feature description"
   ```

## Code Organization

### Module Responsibilities

Our codebase follows a modular architecture with clear separation of concerns:

#### Background Modules (`src/background/`)

- **storage.js**: All Chrome storage operations
- **problemLogic.js**: Problem set management, progress calculation
- **redirects.js**: Redirect rules, bypass system, daily reset
- **messageHandler.js**: Message routing and handlers
- **index.js**: Initialization and lifecycle

#### Content Modules (`src/content/`)

- **api.js**: LeetCode API interactions
- **detector.js**: Problem solve detection and verification
- **ui.js**: Visual feedback (confetti, notifications)
- **index.js**: DOM observation and coordination

#### When Adding Features

**Storage operations** → Add to `src/background/storage.js`

**Problem logic** → Add to `src/background/problemLogic.js`

**Redirect/bypass** → Add to `src/background/redirects.js`

**Message handling** → Add to `src/background/messageHandler.js`

**API calls** → Add to `src/content/api.js`

**UI elements** → Add to `src/content/ui.js`

**Detection logic** → Add to `src/content/detector.js`

## Code Style

### General Principles

1. **Use ES6 modules** (`import`/`export`)
2. **Add JSDoc comments** to all functions
3. **Keep functions focused** (single responsibility)
4. **Maintain ~100-200 lines per file**
5. **Use descriptive variable names**
6. **Avoid global state** when possible

### Code Examples

#### Function Documentation

```javascript
/**
 * Calculate progress for a category
 * @param {Object} category - Category object with problems array
 * @param {Set<string>} solvedProblems - Set of solved problem slugs
 * @returns {Object} Progress object with solved, total, and percentage
 */
export function computeCategoryProgress(category, solvedProblems) {
  const total = category.problems.length;
  const solved = category.problems.filter(p => 
    solvedProblems.has(p.slug)
  ).length;
  const percentage = total > 0 ? (solved / total) * 100 : 0;
  
  return { solved, total, percentage };
}
```

#### Error Handling

```javascript
// Always handle errors gracefully
async function fetchData() {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return null; // Return sensible default
  }
}
```

#### Async/Await

```javascript
// Prefer async/await over promises
// GOOD
async function loadData() {
  const problemSet = await loadProblemSet();
  const aliases = await loadAliases();
  return { problemSet, aliases };
}

// AVOID
function loadData() {
  return loadProblemSet().then(problemSet => {
    return loadAliases().then(aliases => {
      return { problemSet, aliases };
    });
  });
}
```

#### Constants

```javascript
// Use constants for magic numbers
const BYPASS_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Not just:
setTimeout(() => {}, 600000); // What is this?
```

### Naming Conventions

- **Variables/Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Classes**: `PascalCase`
- **Private functions**: `_leadingUnderscore` (if needed)
- **Boolean variables**: Start with `is`, `has`, `should`

```javascript
const REDIRECT_RULE_ID = 1000;
let currentProblemIndex = 0;
const isActive = true;
const hasPermission = false;

function computeNextProblem() { }
function _internalHelper() { }
```

## Testing

### Testing Requirements

All code changes must include tests:

- **New features**: Add unit tests
- **Bug fixes**: Add regression test
- **Refactoring**: Ensure existing tests pass

### Writing Tests

```javascript
import * as storage from '../../src/background/storage.js';

describe('storage.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getState', () => {
    it('should return default state when storage is empty', async () => {
      chrome.storage.sync.get.mockResolvedValue({});
      
      const state = await storage.getState();
      
      expect(state.currentCategoryIndex).toBe(0);
      expect(state.currentProblemIndex).toBe(0);
    });
  });
});
```

### Test Guidelines

1. **Test behavior, not implementation**
2. **Use descriptive test names**: "should do X when Y"
3. **Arrange-Act-Assert pattern**
4. **One assertion per test** (when possible)
5. **Mock external dependencies**

### Coverage Requirements

- Aim for **80%+ coverage** on all metrics
- All new code should be tested
- Run `npm run test:coverage` to check

See [TESTING.md](TESTING.md) for detailed testing guide.

## Pull Request Process

### Before Submitting

1. ✅ Tests pass: `npm test`
2. ✅ Coverage maintained: `npm run test:coverage`
3. ✅ Code follows style guide
4. ✅ Documentation updated (if needed)
5. ✅ Extension loads without errors
6. ✅ Manual testing completed

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested the changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Code follows style guide
- [ ] All tests pass
```

### Review Process

1. Submit PR with clear description
2. Address reviewer feedback
3. Ensure CI tests pass
4. Squash commits if requested
5. PR will be merged when approved

## Module Guidelines

### Adding New Features

When adding features, place code in the appropriate module:

#### Example: Adding a New Storage Feature

```javascript
// src/background/storage.js

/**
 * Get user preferences
 * @returns {Promise<Object>} User preferences
 */
export async function getUserPreferences() {
  const result = await chrome.storage.sync.get(['preferences']);
  return result.preferences || {
    celebrationEnabled: true,
    theme: 'light'
  };
}

/**
 * Save user preferences
 * @param {Object} preferences - Preferences to save
 * @returns {Promise<void>}
 */
export async function saveUserPreferences(preferences) {
  await chrome.storage.sync.set({ preferences });
}
```

#### Example: Adding a New Message Handler

```javascript
// src/background/messageHandler.js

async function handleGetPreferences(message) {
  const preferences = await storage.getUserPreferences();
  return {
    success: true,
    preferences
  };
}

// Add to message router
switch (message.type) {
  case 'GET_PREFERENCES':
    response = await handleGetPreferences(message);
    break;
  // ... other cases
}
```

### Breaking Down Large Files

If a file exceeds ~200-300 lines:

1. Identify logical groupings
2. Extract to new module
3. Update imports
4. Add tests for new module

## Common Pitfalls

### 1. Forgetting to Mock Chrome APIs

```javascript
// BAD: Will fail in tests
const state = await chrome.storage.sync.get(['key']);

// GOOD: Mocked in tests/setup.js
chrome.storage.sync.get.mockResolvedValue({ key: 'value' });
```

### 2. Not Handling Async Errors

```javascript
// BAD: Unhandled rejection
async function fetch() {
  return await someAsyncOperation();
}

// GOOD: Error handling
async function fetch() {
  try {
    return await someAsyncOperation();
  } catch (error) {
    console.error('Failed:', error);
    return null;
  }
}
```

### 3. Circular Dependencies

```javascript
// BAD: storage.js imports redirects.js, redirects.js imports storage.js
// GOOD: Move shared logic to separate module or pass as parameter
```

### 4. Side Effects in Imports

```javascript
// BAD: Code runs on import
export const data = fetchData(); // Runs immediately

// GOOD: Export function
export async function getData() {
  return await fetchData();
}
```

## Getting Help

- Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Check [TESTING.md](TESTING.md) for testing help
- Check [API.md](API.md) for function documentation
- Open an issue for questions

## Code of Conduct

- Be respectful and constructive
- Help others learn and grow
- Focus on the code, not the person
- Assume good intentions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Leetcode Buddy! 🎉

