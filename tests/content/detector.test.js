/**
 * Unit tests for src/content/detector.js
 * Tests problem detection and notification logic
 */

import * as detector from '../../src/content/detector.js';

describe('detector.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.runtime.sendMessage.mockResolvedValue({ success: true });
    global.fetch.mockClear();
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/problems/two-sum/' }
    });
  });

  describe('sendMessageSafely', () => {
    it('should send message successfully', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ success: true, data: 'test' });
      
      const response = await detector.sendMessageSafely({ type: 'TEST' });
      
      expect(response.success).toBe(true);
      expect(response.data).toBe('test');
    });

    it('should handle context invalidation error', async () => {
      chrome.runtime.id = undefined; // Simulate context invalidation
      
      const response = await detector.sendMessageSafely({ type: 'TEST' });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Context invalidated');
      
      // Restore
      chrome.runtime.id = 'mock-extension-id';
    });

    it('should handle message port closed error', async () => {
      // Ensure chrome.runtime.id exists
      chrome.runtime.id = 'mock-extension-id';
      const error = new Error('Attempting to use a disconnected port object');
      chrome.runtime.sendMessage.mockRejectedValue(error);
      
      // Should catch the error and return error response
      const response = await detector.sendMessageSafely({ type: 'TEST' });
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Context invalidated');
    });

    it('should re-throw other errors', async () => {
      const error = new Error('Some other error');
      chrome.runtime.sendMessage.mockRejectedValue(error);
      
      await expect(detector.sendMessageSafely({ type: 'TEST' }))
        .rejects.toThrow('Some other error');
    });
  });

  describe('checkAndNotify', () => {
    beforeEach(() => {
      // Mock aliases
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          'best-time-to-buy-and-sell-crypto': 'best-time-to-buy-and-sell-stock'
        })
      });
    });

    it('should not notify if no slug found in URL', async () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { pathname: '/problems/' }
      });
      
      await detector.checkAndNotify();
      
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('should query problem status', async () => {
      // Mock document.querySelector for username extraction
      document.querySelector = jest.fn().mockReturnValue(null);
      
      // Mock aliases load (checkAndNotify calls resolveAlias which needs aliases)
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({})
      });
      
      // Mock GraphQL response for status
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { question: { status: 'ac' } }
        })
      });
      
      // Mock username fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { userStatus: { username: 'testuser' } }
        })
      });
      
      // Mock recent submissions
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            recentSubmissionList: [
              {
                titleSlug: 'two-sum',
                timestamp: String(Math.floor(Date.now() / 1000)),
                statusDisplay: 'Accepted'
              }
            ]
          }
        })
      });
      
      // Mock get expected problem (GET_STATUS) - currentProblem is the problem object
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        currentProblem: { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
      });
      
      // Mock final notification (PROBLEM_SOLVED)
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        dailySolved: true
      });
      
      await detector.checkAndNotify();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    it('should not notify if problem not solved', async () => {
      // Mock GraphQL response for status (not solved)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { question: { status: null } }
        })
      });
      
      await detector.checkAndNotify();
      
      // Should only call sendMessage once to get expected problem, not to report solve
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PROBLEM_SOLVED' })
      );
    });

    it('should verify problem was solved today', async () => {
      // Mock GraphQL response for status (solved)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { question: { status: 'ac' } }
        })
      });
      
      // Mock username fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { userStatus: { username: 'testuser' } }
        })
      });
      
      const todayTimestamp = Math.floor(Date.now() / 1000);
      
      // Mock recent submissions with today's timestamp
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            recentSubmissionList: [
              {
                titleSlug: 'two-sum',
                timestamp: String(todayTimestamp),
                statusDisplay: 'Accepted'
              }
            ]
          }
        })
      });
      
      // Mock get expected problem (GET_STATUS)
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        currentProblem: { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
      });
      
      // Mock final notification
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        dailySolved: true
      });
      
      await detector.checkAndNotify();
      
      // Should notify with verifiedToday: true
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PROBLEM_SOLVED',
          verifiedToday: true
        })
      );
    });

    it('should not count old solutions as solved today', async () => {
      // Mock GraphQL response for status (solved)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { question: { status: 'ac' } }
        })
      });
      
      // Mock username fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { userStatus: { username: 'testuser' } }
        })
      });
      
      const yesterdayTimestamp = Math.floor((Date.now() - 86400000) / 1000);
      
      // Mock recent submissions with yesterday's timestamp
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            recentSubmissionList: [
              {
                titleSlug: 'two-sum',
                timestamp: String(yesterdayTimestamp),
                statusDisplay: 'Accepted'
              }
            ]
          }
        })
      });
      
      // Mock get expected problem (GET_STATUS)
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        currentProblem: { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
      });
      
      await detector.checkAndNotify();
      
      // Should not count as solved today
      const problemSolvedCall = chrome.runtime.sendMessage.mock.calls.find(
        call => call[0].type === 'PROBLEM_SOLVED'
      );
      
      expect(problemSolvedCall).toBeFalsy();
    });

    it('should not notify if solving wrong problem', async () => {
      // Mock GraphQL response for status (solved)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { question: { status: 'ac' } }
        })
      });
      
      // Mock username fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { userStatus: { username: 'testuser' } }
        })
      });
      
      const todayTimestamp = Math.floor(Date.now() / 1000);
      
      // Mock recent submissions
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            recentSubmissionList: [
              {
                titleSlug: 'two-sum',
                timestamp: String(todayTimestamp),
                statusDisplay: 'Accepted'
              }
            ]
          }
        })
      });
      
      // Mock get expected problem (different problem)
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        currentProblem: { slug: 'valid-anagram' }
      });
      
      await detector.checkAndNotify();
      
      // Should not count as daily solve since it's not the expected problem
      const problemSolvedCall = chrome.runtime.sendMessage.mock.calls.find(
        call => call[0].type === 'PROBLEM_SOLVED' && call[0].verifiedToday
      );
      
      expect(problemSolvedCall).toBeFalsy();
    });

    it('should handle username fetch failure gracefully', async () => {
      // Mock document.querySelector for username extraction
      document.querySelector = jest.fn().mockReturnValue(null);
      
      // Mock aliases load
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({})
      });
      
      // Mock GraphQL response for status (solved)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { question: { status: 'ac' } }
        })
      });
      
      // Mock username fetch failure
      global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));
      
      // Mock get expected problem (GET_STATUS) - will be called because solvedToday=true on error
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        currentProblem: { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
      });
      
      // Mock final notification (PROBLEM_SOLVED)
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        dailySolved: true
      });
      
      await detector.checkAndNotify();
      
      // Should still work with status-only check (fallback to solvedToday=true on error)
      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    it('should resolve problem aliases', async () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { pathname: '/problems/best-time-to-buy-and-sell-crypto/' }
      });
      
      // Mock document.querySelector for username extraction
      document.querySelector = jest.fn().mockReturnValue(null);
      
      // Mock aliases load with the alias mapping
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          'best-time-to-buy-and-sell-crypto': 'best-time-to-buy-and-sell-stock'
        })
      });
      
      // Mock GraphQL response for canonical slug
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { question: { status: 'ac' } }
        })
      });
      
      // Mock username
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { userStatus: { username: 'testuser' } }
        })
      });
      
      const todayTimestamp = Math.floor(Date.now() / 1000);
      
      // Mock recent submissions with canonical slug
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            recentSubmissionList: [
              {
                titleSlug: 'best-time-to-buy-and-sell-stock',
                timestamp: String(todayTimestamp),
                statusDisplay: 'Accepted'
              }
            ]
          }
        })
      });
      
      // Mock get expected problem (GET_STATUS)
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        currentProblem: { slug: 'best-time-to-buy-and-sell-stock', id: 121, title: 'Best Time to Buy and Sell Stock', difficulty: 'Easy' }
      });
      
      // Mock final notification (PROBLEM_SOLVED)
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        dailySolved: true
      });
      
      await detector.checkAndNotify();
      
      // Should use canonical slug in notification
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PROBLEM_SOLVED',
          slug: 'best-time-to-buy-and-sell-stock'
        })
      );
    });
  });
});

