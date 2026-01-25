/**
 * Unit tests for src/background/redirects.js
 * Tests redirect rules, bypass functionality, and daily reset
 */

import * as redirects from '../../src/background/redirects.js';

describe('redirects.js', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue();
    chrome.storage.local.remove.mockResolvedValue();
    chrome.storage.sync.get.mockResolvedValue({
      currentCategoryIndex: 0,
      currentProblemIndex: 0,
      solvedProblems: [],
      selectedProblemSet: 'neetcode250',
      userExclusionList: ['github.com', 'linkedin.com'],
      positions: {
        neetcode250: { categoryIndex: 0, problemIndex: 0 }
      }
    });
    chrome.declarativeNetRequest.updateDynamicRules.mockResolvedValue();
    
    // Mock problem set loading
    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockProblemSet)
    });
  });

  describe('installRedirectRule', () => {
    it('should install redirect rule with correct configuration', async () => {
      await redirects.installRedirectRule();
      
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [1000],
        addRules: [
          expect.objectContaining({
            id: 1000,
            priority: 1,
            action: expect.objectContaining({
              type: 'redirect'
            }),
            condition: expect.objectContaining({
              resourceTypes: ['main_frame']
            })
          })
        ]
      });
    });

    it('should exclude whitelisted domains from redirect', async () => {
      // Mock user exclusion list (defaults: github.com, linkedin.com)
      chrome.storage.sync.get.mockResolvedValue({
        currentCategoryIndex: 0,
        currentProblemIndex: 0,
        solvedProblems: [],
        userExclusionList: ['github.com', 'linkedin.com']
      });
      
      await redirects.installRedirectRule();
      
      const call = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
      const rule = call.addRules[0];
      
      // System domains (always excluded)
      expect(rule.condition.excludedRequestDomains).toContain('leetcode.com');
      expect(rule.condition.excludedRequestDomains).toContain('neetcode.io');
      expect(rule.condition.excludedRequestDomains).toContain('accounts.google.com');
      
      // User domains (from storage)
      expect(rule.condition.excludedRequestDomains).toContain('github.com');
      expect(rule.condition.excludedRequestDomains).toContain('linkedin.com');
    });

    it('should redirect to current problem URL', async () => {
      await redirects.installRedirectRule();
      
      const call = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
      const rule = call.addRules[0];
      
      expect(rule.action.redirect.url).toContain('leetcode.com/problems/');
      expect(rule.action.redirect.url).toContain('two-sum');
    });

    it('should handle errors gracefully', async () => {
      chrome.declarativeNetRequest.updateDynamicRules.mockRejectedValue(
        new Error('Failed to update rules')
      );
      
      // Should not throw
      await expect(redirects.installRedirectRule()).resolves.not.toThrow();
    });
  });

  describe('removeRedirectRule', () => {
    it('should remove redirect rule by ID', async () => {
      await redirects.removeRedirectRule();
      
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [1000],
        addRules: []
      });
    });

    it('should handle errors gracefully', async () => {
      chrome.declarativeNetRequest.updateDynamicRules.mockRejectedValue(
        new Error('Failed to remove rule')
      );
      
      await expect(redirects.removeRedirectRule()).resolves.not.toThrow();
    });
  });

  describe('checkAndRestoreRedirect', () => {
    it('should not restore redirect if bypass is active', async () => {
      const futureTime = Date.now() + 300000; // 5 minutes from now
      chrome.storage.local.get.mockResolvedValue({
        bypassUntil: futureTime,
        nextBypassAllowed: futureTime + 1800000
      });
      
      await redirects.checkAndRestoreRedirect();
      
      expect(chrome.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
    });

    it('should not restore redirect if daily solve is active', async () => {
      const today = new Date().toISOString().split('T')[0];
      chrome.storage.local.get.mockResolvedValue({
        dailySolveDate: today,
        dailySolveTimestamp: Date.now()
      });
      
      await redirects.checkAndRestoreRedirect();
      
      expect(chrome.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
    });

    it('should restore redirect if bypass expired', async () => {
      const pastTime = Date.now() - 1000; // 1 second ago
      chrome.storage.local.get.mockResolvedValue({
        bypassUntil: pastTime,
        nextBypassAllowed: pastTime + 1800000
      });
      
      await redirects.checkAndRestoreRedirect();
      
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalled();
    });

    it('should restore redirect if daily solve expired', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      chrome.storage.local.get.mockResolvedValue({
        dailySolveDate: yesterday,
        dailySolveTimestamp: Date.now() - 86400000
      });
      
      await redirects.checkAndRestoreRedirect();
      
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalled();
    });
  });

  describe('activateBypass', () => {
    it('should activate bypass when allowed', async () => {
      chrome.storage.local.get.mockResolvedValue({
        nextBypassAllowed: Date.now() - 1000 // Can bypass
      });
      
      const result = await redirects.activateBypass();
      
      expect(result.success).toBe(true);
      expect(result.bypassUntil).toBeGreaterThan(Date.now());
      expect(result.nextBypassAllowed).toBeGreaterThan(result.bypassUntil);
      expect(chrome.storage.local.set).toHaveBeenCalled();
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [1000],
        addRules: []
      });
    });

    it('should reject bypass during cooldown', async () => {
      const futureTime = Date.now() + 300000; // 5 minutes cooldown
      chrome.storage.local.get.mockResolvedValue({
        nextBypassAllowed: futureTime
      });
      
      const result = await redirects.activateBypass();
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('cooldown');
      expect(result.remainingMs).toBeGreaterThan(0);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should set correct bypass duration and cooldown', async () => {
      chrome.storage.local.get.mockResolvedValue({
        nextBypassAllowed: Date.now() - 1000
      });
      
      await redirects.activateBypass();
      
      const call = chrome.storage.local.set.mock.calls[0][0];
      expect(call.bypassUntil).toBeGreaterThan(Date.now());
      expect(call.nextBypassAllowed).toBeGreaterThan(call.bypassUntil);
    });

    it('should return bypass info on success', async () => {
      chrome.storage.local.get.mockResolvedValue({
        nextBypassAllowed: Date.now() - 1000
      });
      
      const result = await redirects.activateBypass();
      
      expect(result.success).toBe(true);
      expect(result.bypassUntil).toBeGreaterThan(Date.now());
      expect(result.nextBypassAllowed).toBeGreaterThan(result.bypassUntil);
    });
  });

  describe('checkDailyReset', () => {
    it('should reset daily solve when day changes', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      chrome.storage.local.get.mockResolvedValue({
        dailySolveDate: yesterday,
        dailySolveTimestamp: Date.now() - 86400000,
        dailySolveProblem: 'two-sum'
      });
      
      await redirects.checkDailyReset();
      
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(
        expect.arrayContaining(['dailySolveDate', 'dailySolveTimestamp'])
      );
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalled();
    });

    it('should not reset when still same day', async () => {
      const today = new Date().toISOString().split('T')[0];
      chrome.storage.local.get.mockResolvedValue({
        dailySolveDate: today,
        dailySolveTimestamp: Date.now()
      });
      
      await redirects.checkDailyReset();
      
      expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    });

    it('should handle no previous daily solve data', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      
      await expect(redirects.checkDailyReset()).resolves.not.toThrow();
      expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    });

    it('should reset at midnight boundary', async () => {
      // Simulate yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toISOString().split('T')[0];
      
      chrome.storage.local.get.mockResolvedValue({
        dailySolveDate: yesterdayString,
        dailySolveTimestamp: yesterday.getTime()
      });
      
      // Mock problem set for installRedirectRule
      global.fetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          categories: [{
            name: 'Arrays & Hashing',
            problems: [{ slug: 'two-sum', id: 1, title: 'Two Sum', difficulty: 'Easy' }]
          }]
        })
      });
      
      chrome.storage.sync.get.mockResolvedValue({
        currentCategoryIndex: 0,
        currentProblemIndex: 0,
        solvedProblems: []
      });
      
      await redirects.checkDailyReset();
      
      // checkDailyReset calls clearDailySolve() which calls remove
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(
        expect.arrayContaining(['dailySolveDate', 'dailySolveTimestamp', 'dailySolveProblem'])
      );
      // checkDailyReset calls installRedirectRule() which calls updateDynamicRules
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalled();
    });
  });
});

