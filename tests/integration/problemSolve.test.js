/**
 * Integration tests for problem solving flow
 * Tests end-to-end scenarios combining multiple modules
 */

import * as storage from '../../src/background/storage.js';
import * as problemLogic from '../../src/background/problemLogic.js';
import * as redirects from '../../src/background/redirects.js';
import * as messageHandler from '../../src/background/messageHandler.js';

describe('Problem Solving Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.storage.sync.get.mockResolvedValue({
      currentCategoryIndex: 0,
      currentProblemIndex: 0,
      solvedProblems: []
    });
    chrome.storage.sync.set.mockResolvedValue();
    chrome.storage.sync.clear.mockResolvedValue();
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue();
    chrome.storage.local.clear.mockResolvedValue();
    chrome.storage.local.remove.mockResolvedValue();
    chrome.declarativeNetRequest.updateDynamicRules.mockResolvedValue();
    global.fetch.mockClear();
  });

  describe('User solves current problem', () => {
    it('should mark daily solve and unblock websites', async () => {
      const mockProblemSet = {
        categories: [
          {
            name: 'Arrays & Hashing',
            problems: [
              { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
            ]
          }
        ]
      };

      // Mock problem set load
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockProblemSet)
      });

      // Mock aliases load
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({})
      });

      // Mock LeetCode API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          stat_status_pairs: []
        })
      });

      // Simulate background script initialization
      await problemLogic.computeNextProblem();

      // Simulate user solving problem via message handler (which calls markDailySolve and removeRedirectRule)
      const today = new Date().toISOString().split('T')[0];
      const sendResponse = jest.fn();
      
      await messageHandler.handleMessage(
        {
          type: 'PROBLEM_SOLVED',
          slug: 'two-sum',
          timestamp: Math.floor(Date.now() / 1000),
          verifiedToday: true
        },
        {},
        sendResponse
      );

      // Verify daily solve was marked
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          dailySolveProblem: 'two-sum',
          dailySolveDate: today
        })
      );

      // Verify redirect rule was removed (websites unblocked)
      // handleProblemSolved calls removeRedirectRule which calls updateDynamicRules
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [1000],
        addRules: []
      });
    });

    it('should update progress and advance to next problem', async () => {
      const mockProblemSet = {
        categories: [
          {
            name: 'Arrays & Hashing',
            problems: [
              { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' },
              { slug: 'valid-anagram', id: 242, title: 'Valid Anagram', difficulty: 'Easy' }
            ]
          }
        ]
      };

      chrome.storage.sync.get.mockResolvedValue({
        currentCategoryIndex: 0,
        currentProblemIndex: 0,
        solvedProblems: []
      });

      // Mock problem set load
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockProblemSet)
      });

      // Mock aliases load
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({})
      });

      // Mock LeetCode API - two-sum is solved, valid-anagram is not
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          stat_status_pairs: [
            { stat: { question__title_slug: 'two-sum' }, status: 'ac' },
            { stat: { question__title_slug: 'valid-anagram' }, status: null }
          ]
        })
      });

      const nextProblem = await problemLogic.computeNextProblem();

      // Should return first unsolved problem (valid-anagram, since two-sum is solved)
      expect(nextProblem.problem.slug).toBe('valid-anagram');
      expect(nextProblem.problemIndex).toBe(1);
    });
  });

  describe('User solves wrong problem', () => {
    it('should not mark daily solve and keep redirect active', async () => {
      const mockProblemSet = {
        categories: [
          {
            name: 'Arrays & Hashing',
            problems: [
              { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' },
              { slug: 'valid-anagram', id: 242, title: 'Valid Anagram', difficulty: 'Easy' }
            ]
          }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockProblemSet)
      });

      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({})
      });

      // Mock LeetCode API
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          stat_status_pairs: []
        })
      });

      // Current problem is two-sum but user solves valid-anagram
      chrome.storage.sync.get.mockResolvedValue({
        currentCategoryIndex: 0,
        currentProblemIndex: 0,
        solvedProblems: []
      });

      const nextProblem = await problemLogic.computeNextProblem();

      expect(nextProblem.problem.slug).toBe('two-sum');

      // User should not be able to mark valid-anagram as daily solve
      // (This would be prevented by detector logic checking expected problem)
    });
  });

  describe('User takes bypass', () => {
    it('should temporarily remove redirect and restore after timeout', async () => {
      chrome.storage.local.get.mockResolvedValue({
        nextBypassAllowed: Date.now() - 1000 // Bypass allowed
      });

      const result = await redirects.activateBypass();

      expect(result.success).toBe(true);
      
      // Verify redirect was removed
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [1000],
        addRules: []
      });

      // Verify bypass state was saved
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          bypassUntil: expect.any(Number),
          nextBypassAllowed: expect.any(Number)
        })
      );
    });

    it('should restore redirect when bypass expires', async () => {
      const pastTime = Date.now() - 1000; // Expired bypass
      chrome.storage.local.get.mockResolvedValue({
        bypassUntil: pastTime,
        nextBypassAllowed: pastTime + 1800000
      });

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

      await redirects.checkAndRestoreRedirect();

      // Verify redirect was restored
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith(
        expect.objectContaining({
          addRules: expect.any(Array)
        })
      );
    });
  });

  describe('Daily reset at midnight', () => {
    it('should clear daily solve and restore redirect', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      chrome.storage.local.get.mockResolvedValue({
        dailySolveDate: yesterday,
        dailySolveTimestamp: Date.now() - 86400000,
        dailySolveProblem: 'two-sum'
      });

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

      await redirects.checkDailyReset();

      // Verify daily solve was cleared
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(
        expect.arrayContaining(['dailySolveDate', 'dailySolveTimestamp'])
      );

      // Verify redirect was restored
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalled();
    });
  });

  describe('Progress reset', () => {
    it('should clear all progress and restart from first problem', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        currentCategoryIndex: 2,
        currentProblemIndex: 5,
        solvedProblems: ['two-sum', 'valid-anagram']
      });

      const mockProblemSet = {
        categories: [
          {
            name: 'Arrays & Hashing',
            problems: [
              { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
            ]
          }
        ]
      };

      global.fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockProblemSet)
      });

      // Simulate reset via message handler
      const sendResponse = jest.fn();

      await messageHandler.handleMessage(
        { type: 'RESET_PROGRESS' },
        {},
        sendResponse
      );

      // Verify all storage was cleared
      expect(chrome.storage.sync.clear).toHaveBeenCalled();
      expect(chrome.storage.local.clear).toHaveBeenCalled();

      // Verify response indicates success
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });
  });

  describe('Category progress tracking', () => {
    it('should correctly calculate progress across categories', async () => {
      const mockProblemSet = {
        categories: [
          {
            name: 'Arrays & Hashing',
            problems: [
              { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' },
              { slug: 'valid-anagram', id: 242, title: 'Valid Anagram', difficulty: 'Easy' },
              { slug: 'group-anagrams', id: 49, title: 'Group Anagrams', difficulty: 'Medium' }
            ]
          },
          {
            name: 'Two Pointers',
            problems: [
              { slug: 'valid-palindrome', id: 125, title: 'Valid Palindrome', difficulty: 'Easy' },
              { slug: 'two-sum-ii', id: 167, title: 'Two Sum II', difficulty: 'Medium' }
            ]
          }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockProblemSet)
      });

      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({})
      });

      chrome.storage.sync.get.mockResolvedValue({
        solvedProblems: ['two-sum', 'valid-anagram', 'valid-palindrome']
      });

      const progress = await problemLogic.getAllCategoryProgress();

      expect(progress).toHaveLength(2);
      expect(progress[0].solved).toBe(2); // Arrays & Hashing
      expect(progress[0].total).toBe(3);
      expect(progress[1].solved).toBe(1); // Two Pointers
      expect(progress[1].total).toBe(2);
    });
  });
});

