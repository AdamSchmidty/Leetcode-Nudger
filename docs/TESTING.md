# Testing Guide

This document provides comprehensive information about testing in the Leetcode Buddy extension.

## Table of Contents

1. [Running Tests](#running-tests)
2. [Test Structure](#test-structure)
3. [Writing Tests](#writing-tests)
4. [Coverage Goals](#coverage-goals)
5. [Mocking Strategy](#mocking-strategy)
6. [Best Practices](#best-practices)

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Coverage Report

After running `npm run test:coverage`, open `coverage/lcov-report/index.html` in your browser to see detailed coverage statistics.

## Test Structure

Tests are organized by module to mirror the source code structure:

```
tests/
├── setup.js                # Test configuration & mocks
├── background/             # Background module tests
│   ├── storage.test.js
│   ├── problemLogic.test.js
│   ├── redirects.test.js
│   └── messageHandler.test.js
├── content/                # Content module tests
│   ├── api.test.js
│   ├── ui.test.js
│   └── detector.test.js
└── integration/            # Integration tests
    └── problemSolve.test.js
```

### Test File Naming

- Unit tests: `<module>.test.js`
- Integration tests: `<feature>.test.js`
- All test files use `.test.js` extension

## Writing Tests

### Testing Background Modules

Background modules interact with Chrome APIs. Use mocks from `tests/setup.js`:

```javascript
import * as storage from '../../src/background/storage.js';

describe('storage module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save state correctly', async () => {
    chrome.storage.sync.set.mockResolvedValue();
    
    await storage.saveState(0, 0, new Set(['two-sum']));
    
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      currentCategoryIndex: 0,
      currentProblemIndex: 0,
      solvedProblems: ['two-sum']
    });
  });
});
```

### Testing Content Modules

Content modules interact with DOM and fetch. Use jsdom and mocks:

```javascript
import * as api from '../../src/content/api.js';

describe('api module', () => {
  beforeEach(() => {
    global.fetch.mockClear();
  });

  it('should extract slug from URL', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/problems/two-sum/' }
    });
    
    const slug = api.getCurrentSlug();
    
    expect(slug).toBe('two-sum');
  });

  it('should fetch problem status from GraphQL', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: { question: { status: 'ac' } }
      })
    });
    
    const status = await api.queryProblemStatus('two-sum');
    
    expect(status).toBe('ac');
  });
});
```

### Testing UI Components

UI tests verify DOM manipulation:

```javascript
import * as ui from '../../src/content/ui.js';

describe('ui module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should create confetti container', () => {
    ui.triggerConfetti();
    
    const container = document.querySelector('.leetcode-buddy-confetti');
    expect(container).toBeTruthy();
    expect(container.style.position).toBe('fixed');
  });

  it('should display notification', async () => {
    await ui.showSolvedNotification();
    
    const notification = document.querySelector('.leetcode-buddy-notification');
    expect(notification).toBeTruthy();
    expect(notification.textContent).toContain('Congratulations');
  });
});
```

### Integration Tests

Integration tests combine multiple modules:

```javascript
describe('Problem Solving Integration', () => {
  it('should mark daily solve and unblock websites', async () => {
    // Setup: Mock problem set
    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockProblemSet)
    });
    
    // Execute: Solve problem
    const { markDailySolve } = require('../../src/background/storage.js');
    await markDailySolve('two-sum');
    
    // Verify: Daily solve marked
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        dailySolveProblem: 'two-sum'
      })
    );
    
    // Verify: Redirect removed
    expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalled();
  });
});
```

## Coverage Goals

The project aims for high test coverage to ensure reliability:

### Target Metrics

- **Line Coverage**: 80%+
- **Branch Coverage**: 80%+
- **Function Coverage**: 80%+
- **Statement Coverage**: 80%+

### Coverage Exclusions

The following are excluded from coverage requirements:

- Entry point files (`src/**/index.js`) - These are integration points
- Mock data and fixtures
- Configuration files

### Viewing Coverage

```bash
npm run test:coverage
```

Coverage report will be generated in `coverage/` directory:
- `coverage/lcov-report/index.html` - HTML report (open in browser)
- `coverage/lcov.info` - LCOV format (for CI tools)

## Mocking Strategy

### Chrome APIs

All Chrome APIs are mocked in `tests/setup.js`:

```javascript
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      remove: jest.fn()
    }
  },
  runtime: {
    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    id: 'mock-extension-id'
  },
  declarativeNetRequest: {
    updateDynamicRules: jest.fn()
  }
};
```

### Fetch API

Fetch is mocked globally:

```javascript
global.fetch = jest.fn();

// In tests:
global.fetch.mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({ data: 'test' })
});
```

### Window/Document

DOM properties are mocked as needed:

```javascript
Object.defineProperty(window, 'location', {
  writable: true,
  value: { pathname: '/problems/two-sum/' }
});

Object.defineProperty(document, 'cookie', {
  writable: true,
  value: 'csrftoken=abc123'
});
```

## Best Practices

### 1. Test Organization

- Group related tests in `describe` blocks
- Use descriptive test names: "should do X when Y"
- Keep tests focused on single behavior

```javascript
describe('computeNextProblem', () => {
  it('should return first problem when nothing solved', async () => {
    // Test implementation
  });

  it('should skip solved problems', async () => {
    // Test implementation
  });

  it('should return null when all problems solved', async () => {
    // Test implementation
  });
});
```

### 2. Mock Cleanup

Always clear mocks between tests:

```javascript
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch.mockClear();
});
```

### 3. Test Independence

Each test should be independent:

```javascript
// BAD: Tests depend on execution order
let sharedState;
it('test 1', () => { sharedState = 'value'; });
it('test 2', () => { expect(sharedState).toBe('value'); });

// GOOD: Each test sets up its own state
it('test 1', () => {
  const localState = 'value';
  // test with localState
});

it('test 2', () => {
  const localState = 'value';
  // test with localState
});
```

### 4. Async Testing

Properly handle async operations:

```javascript
// Use async/await
it('should fetch data', async () => {
  const result = await fetchData();
  expect(result).toBe('data');
});

// Or return promise
it('should fetch data', () => {
  return fetchData().then(result => {
    expect(result).toBe('data');
  });
});
```

### 5. Edge Cases

Test edge cases and error conditions:

```javascript
describe('isSolvedToday', () => {
  it('should return true for today timestamp', () => {
    // Happy path
  });

  it('should return false for yesterday timestamp', () => {
    // Edge case: past date
  });

  it('should return false for tomorrow timestamp', () => {
    // Edge case: future date
  });

  it('should handle null timestamp', () => {
    // Error case: null input
  });

  it('should handle undefined timestamp', () => {
    // Error case: undefined input
  });
});
```

### 6. Meaningful Assertions

Use specific assertions:

```javascript
// BAD: Too vague
expect(result).toBeTruthy();

// GOOD: Specific expectation
expect(result.success).toBe(true);
expect(result.data).toEqual({ id: 1, name: 'Test' });
```

### 7. Test Readability

Use the Arrange-Act-Assert pattern:

```javascript
it('should calculate progress correctly', () => {
  // Arrange
  const category = { problems: [{ slug: 'a' }, { slug: 'b' }] };
  const solved = new Set(['a']);
  
  // Act
  const progress = computeCategoryProgress(category, solved);
  
  // Assert
  expect(progress.solved).toBe(1);
  expect(progress.total).toBe(2);
  expect(progress.percentage).toBe(50);
});
```

## Troubleshooting

### Tests Failing Due to Imports

If you see errors about ES modules, ensure `jest.config.js` has:

```javascript
module.exports = {
  transform: {}, // Disable transforms for ES modules
  // ...
};
```

### Mock Not Working

Ensure mocks are cleared between tests:

```javascript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Timeout Errors

For long-running tests, increase timeout:

```javascript
it('should complete long operation', async () => {
  // Test implementation
}, 10000); // 10 second timeout
```

### Coverage Not Reaching Goals

Check which files/branches are uncovered:

```bash
npm run test:coverage
# Open coverage/lcov-report/index.html
```

Focus on:
1. Adding tests for uncovered functions
2. Testing both branches of conditionals
3. Testing error paths

## Running Specific Tests

```bash
# Run specific test file
npm test -- tests/background/storage.test.js

# Run tests matching pattern
npm test -- --testNamePattern="storage"

# Run only failed tests
npm test -- --onlyFailures
```

## Continuous Integration

See `.github/workflows/test.yml` for CI configuration. Tests run automatically on:
- Pull requests
- Pushes to main branch

## Further Reading

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/)
- [Chrome Extension Testing](https://developer.chrome.com/docs/extensions/mv3/tut_testing/)

