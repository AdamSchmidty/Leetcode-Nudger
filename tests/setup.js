// Mock chrome.storage API
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

// Mock fetch
global.fetch = jest.fn();

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: 'csrftoken=mock-csrf-token'
});

