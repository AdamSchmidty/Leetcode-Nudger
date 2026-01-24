/**
 * Unit tests for src/content/api.js
 * Tests LeetCode API interactions and data extraction
 */

import * as api from '../../src/content/api.js';

describe('api.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('loadAliases', () => {
    it('should fetch and cache aliases from extension resources', async () => {
      const mockAliases = {
        'best-time-to-buy-and-sell-crypto': 'best-time-to-buy-and-sell-stock'
      };
      
      global.fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockAliases)
      });
      
      const aliases = await api.loadAliases();
      
      expect(chrome.runtime.getURL).toHaveBeenCalledWith(
        expect.stringContaining('problemAliases.json')
      );
      expect(aliases).toEqual(mockAliases);
    });

    it('should return empty object on fetch failure', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      const aliases = await api.loadAliases();
      
      expect(aliases).toEqual({});
    });

    it('should fetch aliases on each call', async () => {
      const mockAliases = { 'alias': 'original' };
      global.fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockAliases)
      });
      
      await api.loadAliases();
      global.fetch.mockClear();
      
      await api.loadAliases();
      
      // Implementation fetches on each call (no caching check)
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('resolveAlias', () => {
    beforeEach(async () => {
      const mockAliases = {
        'best-time-to-buy-and-sell-crypto': 'best-time-to-buy-and-sell-stock',
        'sort-an-array': 'sort-array'
      };
      global.fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockAliases)
      });
      await api.loadAliases();
    });

    it('should resolve alias to canonical slug', () => {
      const result = api.resolveAlias('best-time-to-buy-and-sell-crypto');
      expect(result).toBe('best-time-to-buy-and-sell-stock');
    });

    it('should return original slug if no alias exists', () => {
      const result = api.resolveAlias('two-sum');
      expect(result).toBe('two-sum');
    });

    it('should handle null input', () => {
      const result = api.resolveAlias(null);
      expect(result).toBe(null);
    });
  });

  describe('getCurrentSlug', () => {
    it('should extract slug from valid problem URL', () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { pathname: '/problems/two-sum/' }
      });
      
      const slug = api.getCurrentSlug();
      
      expect(slug).toBe('two-sum');
    });

    it('should extract slug from URL without trailing slash', () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { pathname: '/problems/valid-anagram' }
      });
      
      const slug = api.getCurrentSlug();
      
      expect(slug).toBe('valid-anagram');
    });

    it('should return null for invalid URL', () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { pathname: '/problems/' }
      });
      
      const slug = api.getCurrentSlug();
      
      expect(slug).toBe(null);
    });

    it('should return null for non-problem URL', () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { pathname: '/problemset/all/' }
      });
      
      const slug = api.getCurrentSlug();
      
      expect(slug).toBe(null);
    });
  });

  describe('getCsrfToken', () => {
    it('should extract CSRF token from cookies', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'csrftoken=abc123xyz; sessionid=456def'
      });
      
      const token = api.getCsrfToken();
      
      expect(token).toBe('abc123xyz');
    });

    it('should return empty string when CSRF token not present', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'sessionid=456def; other=value'
      });
      
      const token = api.getCsrfToken();
      
      expect(token).toBe('');
    });

    it('should handle empty cookies', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: ''
      });
      
      const token = api.getCsrfToken();
      
      expect(token).toBe('');
    });
  });

  describe('getCurrentUsername', () => {
    beforeEach(() => {
      // Mock document.querySelector to return null (no username in page data)
      document.querySelector = jest.fn().mockReturnValue(null);
    });

    it('should fetch username from LeetCode API', async () => {
      const mockResponse = {
        data: {
          userStatus: {
            username: 'testuser'
          }
        }
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });
      
      const username = await api.getCurrentUsername();
      
      expect(username).toBe('testuser');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://leetcode.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should retry on failure', async () => {
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            data: {
              userStatus: { username: 'testuser' }
            }
          })
        });
      
      const username = await api.getCurrentUsername(2);
      
      expect(username).toBe('testuser');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return null after all retries fail', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      const username = await api.getCurrentUsername(2);
      
      expect(username).toBe(null);
      expect(global.fetch).toHaveBeenCalledTimes(2); // retries=2 means 2 attempts
    });
  });

  describe('queryProblemStatus', () => {
    it('should query problem status and return "ac" for solved', async () => {
      const mockResponse = {
        data: {
          question: {
            status: 'ac'
          }
        }
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });
      
      const status = await api.queryProblemStatus('two-sum');
      
      expect(status).toBe('ac');
    });

    it('should return null for unsolved problem', async () => {
      const mockResponse = {
        data: {
          question: {
            status: null
          }
        }
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });
      
      const status = await api.queryProblemStatus('two-sum');
      
      expect(status).toBe(null);
    });

    it('should return null on fetch error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      const status = await api.queryProblemStatus('two-sum');
      
      expect(status).toBe(null);
    });
  });

  describe('queryRecentSubmissions', () => {
    it('should fetch recent submissions', async () => {
      const mockSubmissions = [
        { timestamp: '1234567890', statusDisplay: 'Accepted', lang: 'python3' },
        { timestamp: '1234567800', statusDisplay: 'Wrong Answer', lang: 'javascript' }
      ];
      
      const mockResponse = {
        data: {
          recentSubmissionList: mockSubmissions
        }
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });
      
      const submissions = await api.queryRecentSubmissions('testuser');
      
      expect(submissions).toEqual(mockSubmissions);
    });

    it('should return empty array on fetch error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      const submissions = await api.queryRecentSubmissions('testuser');
      
      expect(submissions).toEqual([]);
    });
  });

  describe('queryProblemSubmissions', () => {
    it('should fetch problem-specific submissions', async () => {
      const mockSubmissions = [
        { timestamp: '1234567890', statusDisplay: 'Accepted' },
        { timestamp: '1234567800', statusDisplay: 'Wrong Answer' }
      ];
      
      const mockResponse = {
        data: {
          submissionList: {
            submissions: mockSubmissions
          }
        }
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });
      
      const submissions = await api.queryProblemSubmissions('two-sum');
      
      expect(submissions).toEqual(mockSubmissions);
    });

    it('should return empty array on fetch error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      const submissions = await api.queryProblemSubmissions('two-sum');
      
      expect(submissions).toEqual([]);
    });
  });

  describe('isSolvedToday', () => {
    it('should return true for timestamp from today', () => {
      const todayTimestamp = Math.floor(Date.now() / 1000);
      
      expect(api.isSolvedToday(todayTimestamp)).toBe(true);
    });

    it('should return false for timestamp from yesterday', () => {
      const yesterdayTimestamp = Math.floor((Date.now() - 86400000) / 1000);
      
      expect(api.isSolvedToday(yesterdayTimestamp)).toBe(false);
    });

    it('should return false for timestamp from tomorrow', () => {
      const tomorrowTimestamp = Math.floor((Date.now() + 86400000) / 1000);
      
      expect(api.isSolvedToday(tomorrowTimestamp)).toBe(false);
    });

    it('should handle null timestamp', () => {
      expect(api.isSolvedToday(null)).toBe(false);
    });

    it('should handle undefined timestamp', () => {
      expect(api.isSolvedToday(undefined)).toBe(false);
    });

    it('should correctly compare dates at midnight boundary', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const midnightTimestamp = Math.floor(today.getTime() / 1000);
      
      expect(api.isSolvedToday(midnightTimestamp)).toBe(true);
    });
  });
});

