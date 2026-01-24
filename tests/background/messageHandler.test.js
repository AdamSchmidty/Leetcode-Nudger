/**
 * Unit tests for src/background/messageHandler.js
 * Tests message routing and handler functions
 */

import * as messageHandler from '../../src/background/messageHandler.js';

describe('messageHandler.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.storage.sync.get.mockResolvedValue({
      currentCategoryIndex: 0,
      currentProblemIndex: 0,
      solvedProblems: []
    });
    chrome.storage.sync.set.mockResolvedValue();
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue();
    chrome.declarativeNetRequest.updateDynamicRules.mockResolvedValue();
    global.fetch.mockClear();
  });

  describe('setupMessageListener', () => {
    it('should register message listener', () => {
      messageHandler.setupMessageListener();
      
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
  });

  describe('handleMessage - PROBLEM_SOLVED', () => {
    it('should mark problem as solved and update state', async () => {
      const message = {
        type: 'PROBLEM_SOLVED',
        slug: 'two-sum',
        timestamp: Math.floor(Date.now() / 1000),
        verifiedToday: true
      };
      
      const sendResponse = jest.fn();
      
      // Mock problem set load
      global.fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          categories: [
            {
              name: 'Arrays & Hashing',
              problems: [
                { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
              ]
            }
          ]
        })
      });
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });

    it('should mark daily solve when problem is verified today', async () => {
      const message = {
        type: 'PROBLEM_SOLVED',
        slug: 'two-sum',
        timestamp: Math.floor(Date.now() / 1000),
        verifiedToday: true
      };
      
      const sendResponse = jest.fn();
      
      global.fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          categories: [
            {
              name: 'Arrays & Hashing',
              problems: [
                { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
              ]
            }
          ]
        })
      });
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          dailySolveProblem: 'two-sum'
        })
      );
    });

    it('should not mark daily solve for old submissions', async () => {
      const message = {
        type: 'PROBLEM_SOLVED',
        slug: 'two-sum',
        timestamp: null,
        verifiedToday: false
      };
      
      const sendResponse = jest.fn();
      
      global.fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          categories: [
            {
              name: 'Arrays & Hashing',
              problems: [
                { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
              ]
            }
          ]
        })
      });
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      const response = sendResponse.mock.calls[0][0];
      expect(response.dailySolved).toBe(false);
    });
  });

  describe('handleMessage - GET_STATUS', () => {
    it('should return current status with problem info', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        currentCategoryIndex: 0,
        currentProblemIndex: 0,
        solvedProblems: ['two-sum']
      });
      chrome.storage.local.get.mockResolvedValue({});
      
      const message = { type: 'GET_STATUS' };
      const sendResponse = jest.fn();
      
      // Mock problem set
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          categories: [
            {
              name: 'Arrays & Hashing',
              problems: [
                { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' },
                { slug: 'valid-anagram', id: 242, title: 'Valid Anagram', difficulty: 'Easy' }
              ]
            }
          ]
        })
      });
      
      // Mock LeetCode API
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          stat_status_pairs: [
            { stat: { question__title_slug: 'two-sum' }, status: 'ac' }
          ]
        })
      });
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          currentProblem: expect.objectContaining({
            slug: expect.any(String),
            title: expect.any(String)
          })
        })
      );
    });

    it('should include daily solve status', async () => {
      const today = new Date().toISOString().split('T')[0];
      chrome.storage.sync.get.mockResolvedValue({
        currentCategoryIndex: 0,
        currentProblemIndex: 0,
        solvedProblems: []
      });
      chrome.storage.local.get.mockResolvedValue({
        dailySolveDate: today,
        dailySolveTimestamp: Date.now()
      });
      
      const message = { type: 'GET_STATUS' };
      const sendResponse = jest.fn();
      
      // Mock problem set
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          categories: [
            {
              name: 'Arrays & Hashing',
              problems: [
                { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
              ]
            }
          ]
        })
      });
      
      // Mock LeetCode API
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          stat_status_pairs: []
        })
      });
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      const response = sendResponse.mock.calls[0][0];
      expect(response.dailySolved).toBe(true);
    });
  });

  describe('handleMessage - GET_DETAILED_PROGRESS', () => {
    it('should return progress for all categories', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        solvedProblems: ['two-sum', 'valid-anagram']
      });
      
      const message = { type: 'GET_DETAILED_PROGRESS' };
      const sendResponse = jest.fn();
      
      global.fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          categories: [
            {
              name: 'Arrays & Hashing',
              problems: [
                { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' },
                { slug: 'valid-anagram', id: 242, title: 'Valid Anagram', difficulty: 'Easy' },
                { slug: 'group-anagrams', id: 49, title: 'Group Anagrams', difficulty: 'Medium' }
              ]
            }
          ]
        })
      });
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      const response = sendResponse.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.categories).toBeInstanceOf(Array);
      expect(response.categories[0]).toHaveProperty('name');
      expect(response.categories[0]).toHaveProperty('solved');
      expect(response.categories[0]).toHaveProperty('total');
    });
  });

  describe('handleMessage - ACTIVATE_BYPASS', () => {
    it('should activate bypass when allowed', async () => {
      chrome.storage.local.get.mockResolvedValue({
        nextBypassAllowed: Date.now() - 1000
      });
      
      const message = { type: 'ACTIVATE_BYPASS' };
      const sendResponse = jest.fn();
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });

    it('should reject bypass during cooldown', async () => {
      chrome.storage.local.get.mockResolvedValue({
        nextBypassAllowed: Date.now() + 300000
      });
      
      const message = { type: 'ACTIVATE_BYPASS' };
      const sendResponse = jest.fn();
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          reason: 'cooldown'
        })
      );
    });
  });

  describe('handleMessage - REFRESH_STATUS', () => {
    it('should fetch and update solved problems from LeetCode', async () => {
      const message = { type: 'REFRESH_STATUS' };
      const sendResponse = jest.fn();
      
      // Mock problem set
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          categories: [
            {
              name: 'Arrays & Hashing',
              problems: [
                { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
              ]
            }
          ]
        })
      });
      
      // Mock LeetCode API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          stat_status_pairs: [
            { stat: { question__title_slug: 'two-sum' }, status: 'ac' }
          ]
        })
      });
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      expect(chrome.storage.sync.set).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          totalSolved: expect.any(Number)
        })
      );
    });
  });

  describe('handleMessage - RESET_PROGRESS', () => {
    it('should clear all progress and reset to first problem', async () => {
      const message = { type: 'RESET_PROGRESS' };
      const sendResponse = jest.fn();
      
      global.fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          categories: [
            {
              name: 'Arrays & Hashing',
              problems: [
                { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
              ]
            }
          ]
        })
      });
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      expect(chrome.storage.sync.clear).toHaveBeenCalled();
      expect(chrome.storage.local.clear).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });
  });

  describe('handleMessage - Unknown Type', () => {
    it('should handle unknown message type gracefully', async () => {
      const message = { type: 'UNKNOWN_MESSAGE_TYPE' };
      const sendResponse = jest.fn();
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Unknown message type'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should catch and report errors in message handling', async () => {
      const message = { type: 'GET_STATUS' };
      const sendResponse = jest.fn();
      
      // Force an error
      chrome.storage.sync.get.mockRejectedValue(new Error('Storage error'));
      
      await messageHandler.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String)
        })
      );
    });
  });
});

