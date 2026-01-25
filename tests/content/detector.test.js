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
    global.fetch.mockReset();
    
    // Mock window.location using Object.defineProperty for proper access
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: {
        pathname: '/problems/two-sum/',
        href: 'https://leetcode.com/problems/two-sum/'
      }
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
      const error = new Error('message port closed');
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
      // Ensure chrome.runtime.id exists for sendMessageSafely
      chrome.runtime.id = 'mock-extension-id';
      
      // Reset fetch mock - individual tests will set up their own mocks
      global.fetch.mockReset();
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
      // window.location is already set in beforeEach
      // Ensure chrome.runtime.id exists for sendMessageSafely
      chrome.runtime.id = 'mock-extension-id';
      
      // Mock document.querySelector for username extraction
      document.querySelector = jest.fn().mockReturnValue(null);
      
      // Mock all fetch calls using mockImplementation
      // This handles aliases, status queries, username queries, and submission queries
      global.fetch.mockImplementation((url, options) => {
        const urlStr = typeof url === 'string' ? url : url?.href || String(url);
        
        // Handle aliases load
        if (urlStr.includes('problemAliases.json')) {
          return Promise.resolve({
            json: jest.fn().mockResolvedValue({})
          });
        }
        // Handle GraphQL queries
        if (urlStr.includes('graphql')) {
          // Parse the request body
          let body = {};
          try {
            if (options?.body) {
              body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            }
          } catch (e) {
            console.error('Failed to parse body:', e);
          }
          
          // Check if it's a status query (queryProblemStatus)
          // The query contains "questionStatus" or "question(titleSlug"
          if (body.query && (
              body.query.includes('questionStatus') || 
              body.query.includes('question(titleSlug') ||
              (body.variables && body.variables.titleSlug)
          )) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: { question: { status: 'ac' } }
              })
            });
          }
          // Check if it's a username query
          if (body.query && (body.query.includes('userStatus') || body.query.includes('globalData'))) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: { userStatus: { username: 'testuser' } }
              })
            });
          }
          // Check if it's a recent submissions query
          if (body.query && body.query.includes('recentSubmissionList')) {
            return Promise.resolve({
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
          }
          // Check if it's a problem-specific submissions query (submissionList)
          if (body.query && body.query.includes('submissionList')) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: {
                  submissionList: {
                    submissions: [
                      {
                        timestamp: String(Math.floor(Date.now() / 1000)),
                        statusDisplay: 'Accepted',
                        lang: 'javascript'
                      }
                    ]
                  }
                }
              })
            });
          }
          // Default GraphQL response (fallback)
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({ data: { question: { status: 'ac' } } })
          });
        }
        // Unhandled URL - return error
        console.error('Unhandled fetch URL:', urlStr);
        return Promise.reject(new Error(`Unexpected fetch: ${urlStr}`));
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
      // window.location is already set in beforeEach
      chrome.runtime.id = 'mock-extension-id';
      
      // Mock document.querySelector for username extraction
      document.querySelector = jest.fn().mockReturnValue(null);
      
      const todayTimestamp = Math.floor(Date.now() / 1000);
      
      // Load aliases first to populate the cache (resolveAlias uses cached aliases)
      const api = await import('../../src/content/api.js');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({})
      });
      await api.loadAliases();
      
      // Reset the mock after loading aliases, then set up the implementation
      global.fetch.mockReset();
      
      // Mock all fetch calls using mockImplementation
      global.fetch.mockImplementation((url, options) => {
        const urlStr = typeof url === 'string' ? url : url?.href || String(url);
        
        if (urlStr.includes('problemAliases.json')) {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({})
          });
        }
        if (urlStr.includes('graphql')) {
          let body = {};
          try {
            if (options?.body) {
              body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            }
          } catch (e) {
            // Ignore parse errors
          }
          
          // Check if it's a status query
          if (body.query && (
              body.query.includes('questionStatus') || 
              body.query.includes('question(titleSlug') ||
              (body.variables && body.variables.titleSlug)
          )) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: { question: { status: 'ac' } }
              })
            });
          }
          // Check if it's a username query
          if (body.query && (body.query.includes('userStatus') || body.query.includes('globalData'))) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: { userStatus: { username: 'testuser' } }
              })
            });
          }
          // Check if it's a recent submissions query
          if (body.query && body.query.includes('recentSubmissionList')) {
            return Promise.resolve({
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
          }
          // Check if it's a problem-specific submissions query (submissionList)
          if (body.query && body.query.includes('submissionList')) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: {
                  submissionList: {
                    submissions: [
                      {
                        timestamp: String(todayTimestamp),
                        statusDisplay: 'Accepted',
                        lang: 'javascript'
                      }
                    ]
                  }
                }
              })
            });
          }
          // Default GraphQL response
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({ data: { question: { status: 'ac' } } })
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${urlStr}`));
      });
      
      // Reset sendMessage mock to track calls properly
      chrome.runtime.sendMessage.mockReset();
      
      // Mock get expected problem (GET_STATUS) - this is called first
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        currentProblem: { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
      });
      
      // Mock final notification (PROBLEM_SOLVED) - this is called second
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
      // Ensure window.location is properly set
      Object.defineProperty(window, 'location', {
        writable: true,
        configurable: true,
        value: { 
          pathname: '/problems/two-sum/',
          href: 'https://leetcode.com/problems/two-sum/'
        }
      });
      
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
      
      // Mock problem-specific submissions (fallback check) - also from yesterday
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            submissionList: {
              submissions: [
                {
                  timestamp: String(yesterdayTimestamp),
                  statusDisplay: 'Accepted',
                  lang: 'javascript'
                }
              ]
            }
          }
        })
      });
      
      // Mock get expected problem (GET_STATUS)
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        currentProblem: { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
      });
      
      await detector.checkAndNotify();
      
      // Should not count as solved today - message should be sent with verifiedToday: false
      const problemSolvedCall = chrome.runtime.sendMessage.mock.calls.find(
        call => call[0].type === 'PROBLEM_SOLVED' && call[0].verifiedToday === true
      );
      
      expect(problemSolvedCall).toBeFalsy();
    });

    it('should not notify if solving wrong problem', async () => {
      // Ensure chrome.runtime.id exists
      chrome.runtime.id = 'mock-extension-id';
      
      // Load aliases first
      const api = await import('../../src/content/api.js');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({})
      });
      await api.loadAliases();
      
      // Reset fetch mock
      global.fetch.mockReset();
      
      // Reset sendMessage mock
      chrome.runtime.sendMessage.mockReset();
      
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
      
      // Mock get expected problem (different problem) - this should cause early return
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        currentProblem: { slug: 'valid-anagram' }
      });
      
      await detector.checkAndNotify();
      
      // Should not count as daily solve since it's not the expected problem
      // The code should return early before sending PROBLEM_SOLVED
      const problemSolvedCall = chrome.runtime.sendMessage.mock.calls.find(
        call => call[0] && call[0].type === 'PROBLEM_SOLVED' && call[0].verifiedToday
      );
      
      expect(problemSolvedCall).toBeFalsy();
    });

    it('should handle username fetch failure gracefully', async () => {
      // window.location is already set in beforeEach
      chrome.runtime.id = 'mock-extension-id';
      
      // Mock document.querySelector for username extraction
      document.querySelector = jest.fn().mockReturnValue(null);
      
      // Mock all fetch calls using mockImplementation
      global.fetch.mockImplementation((url, options) => {
        const urlStr = typeof url === 'string' ? url : url?.href || String(url);
        
        if (urlStr.includes('problemAliases.json')) {
          return Promise.resolve({
            json: jest.fn().mockResolvedValue({})
          });
        }
        if (urlStr.includes('graphql')) {
          let body = {};
          try {
            if (options?.body) {
              body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            }
          } catch (e) {
            // Ignore parse errors
          }
          
          // Check if it's a status query
          if (body.query && (
              body.query.includes('questionStatus') || 
              body.query.includes('question(titleSlug') ||
              (body.variables && body.variables.titleSlug)
          )) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: { question: { status: 'ac' } }
              })
            });
          }
          // Check if it's a username query - simulate failure
          if (body.query && (body.query.includes('userStatus') || body.query.includes('globalData'))) {
            return Promise.reject(new Error('Failed to fetch'));
          }
          // Check if it's a recent submissions query
          if (body.query && body.query.includes('recentSubmissionList')) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: {
                  recentSubmissionList: []
                }
              })
            });
          }
          // Check if it's a problem-specific submissions query (submissionList)
          if (body.query && body.query.includes('submissionList')) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: {
                  submissionList: {
                    submissions: []
                  }
                }
              })
            });
          }
          // Default GraphQL response
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({ data: { question: { status: 'ac' } } })
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${urlStr}`));
      });
      
      // Mock get expected problem (GET_STATUS) - will be called because solvedToday=true on error
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        currentProblem: { slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }
      });
      
      // Mock final notification (PROBLEM_SOLVED) - may or may not be called depending on fallback logic
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        dailySolved: true
      });
      
      await detector.checkAndNotify();
      
      // Should still work with status-only check (fallback to solvedToday=true on error)
      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    it('should resolve problem aliases', async () => {
      // Set window.location for this specific test (different pathname)
      Object.defineProperty(window, 'location', {
        writable: true,
        configurable: true,
        value: { 
          pathname: '/problems/best-time-to-buy-and-sell-crypto/',
          href: 'https://leetcode.com/problems/best-time-to-buy-and-sell-crypto/'
        }
      });
      
      chrome.runtime.id = 'mock-extension-id';
      
      // Load aliases first to populate the cache
      const api = await import('../../src/content/api.js');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          'best-time-to-buy-and-sell-crypto': 'best-time-to-buy-and-sell-stock'
        })
      });
      await api.loadAliases();
      
      // Reset fetch mock after loading aliases
      global.fetch.mockReset();
      
      // Reset sendMessage mock
      chrome.runtime.sendMessage.mockReset();
      
      // Mock document.querySelector for username extraction
      document.querySelector = jest.fn().mockReturnValue(null);
      
      const todayTimestamp = Math.floor(Date.now() / 1000);
      
      // Mock all fetch calls using mockImplementation
      global.fetch.mockImplementation((url, options) => {
        const urlStr = typeof url === 'string' ? url : url?.href || String(url);
        
        if (urlStr.includes('problemAliases.json')) {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({
              'best-time-to-buy-and-sell-crypto': 'best-time-to-buy-and-sell-stock'
            })
          });
        }
        if (urlStr.includes('graphql')) {
          let body = {};
          try {
            if (options?.body) {
              body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            }
          } catch (e) {
            // Ignore parse errors
          }
          
          // Check if it's a status query
          if (body.query && (
              body.query.includes('questionStatus') || 
              body.query.includes('question(titleSlug') ||
              (body.variables && body.variables.titleSlug)
          )) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: { question: { status: 'ac' } }
              })
            });
          }
          // Check if it's a username query
          if (body.query && (body.query.includes('userStatus') || body.query.includes('globalData'))) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: { userStatus: { username: 'testuser' } }
              })
            });
          }
          // Check if it's a recent submissions query
          if (body.query && body.query.includes('recentSubmissionList')) {
            return Promise.resolve({
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
          }
          // Check if it's a problem-specific submissions query (submissionList)
          if (body.query && body.query.includes('submissionList')) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                data: {
                  submissionList: {
                    submissions: [
                      {
                        timestamp: String(todayTimestamp),
                        statusDisplay: 'Accepted',
                        lang: 'javascript'
                      }
                    ]
                  }
                }
              })
            });
          }
          // Default GraphQL response
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({ data: { question: { status: 'ac' } } })
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${urlStr}`));
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

