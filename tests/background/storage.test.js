/**
 * Unit tests for src/background/storage.js
 * Tests all chrome.storage operations
 */

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
      expect(state.solvedProblems).toEqual(new Set());
      expect(state.selectedProblemSet).toBe('neetcode250');
    });

    it('should return state from storage', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        currentCategoryIndex: 2,
        currentProblemIndex: 5,
        solvedProblems: ['two-sum', 'valid-anagram'],
        selectedProblemSet: 'neetcode250'
      });
      
      const state = await storage.getState();
      
      expect(state.currentCategoryIndex).toBe(2);
      expect(state.currentProblemIndex).toBe(5);
      expect(state.solvedProblems.size).toBe(2);
      expect(state.solvedProblems.has('two-sum')).toBe(true);
      expect(state.solvedProblems.has('valid-anagram')).toBe(true);
    });

    it('should convert solvedProblems array to Set', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        solvedProblems: ['problem1', 'problem2', 'problem3']
      });
      
      const state = await storage.getState();
      
      expect(state.solvedProblems).toBeInstanceOf(Set);
      expect(state.solvedProblems.size).toBe(3);
    });
  });

  describe('saveState', () => {
    it('should save state to chrome.storage.sync', async () => {
      chrome.storage.sync.set.mockResolvedValue();
      const solvedProblems = new Set(['two-sum', 'valid-anagram']);
      
      await storage.saveState(1, 3, solvedProblems);
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        currentCategoryIndex: 1,
        currentProblemIndex: 3,
        solvedProblems: ['two-sum', 'valid-anagram']
      });
    });

    it('should convert Set to array for storage', async () => {
      chrome.storage.sync.set.mockResolvedValue();
      const solvedProblems = new Set(['a', 'b', 'c']);
      
      await storage.saveState(0, 0, solvedProblems);
      
      const savedData = chrome.storage.sync.set.mock.calls[0][0];
      expect(Array.isArray(savedData.solvedProblems)).toBe(true);
      expect(savedData.solvedProblems.length).toBe(3);
    });
  });

  describe('getDailySolveState', () => {
    it('should return solvedToday as false when no date stored', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      
      const state = await storage.getDailySolveState();
      
      expect(state.solvedToday).toBe(false);
      expect(state.lastSolveDate).toBe('');
      expect(state.lastSolveTimestamp).toBe(0);
    });

    it('should return solvedToday as true when date matches today', async () => {
      const today = new Date().toISOString().split('T')[0];
      chrome.storage.local.get.mockResolvedValue({
        dailySolveDate: today,
        dailySolveTimestamp: Date.now()
      });
      
      const state = await storage.getDailySolveState();
      
      expect(state.solvedToday).toBe(true);
      expect(state.lastSolveDate).toBe(today);
    });

    it('should return solvedToday as false when date is from yesterday', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      chrome.storage.local.get.mockResolvedValue({
        dailySolveDate: yesterday,
        dailySolveTimestamp: Date.now() - 86400000
      });
      
      const state = await storage.getDailySolveState();
      
      expect(state.solvedToday).toBe(false);
      expect(state.lastSolveDate).toBe(yesterday);
    });
  });

  describe('markDailySolve', () => {
    it('should save daily solve with correct date and slug', async () => {
      chrome.storage.local.set.mockResolvedValue();
      const problemSlug = 'two-sum';
      
      await storage.markDailySolve(problemSlug);
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          dailySolveProblem: problemSlug,
          dailySolveDate: expect.any(String),
          dailySolveTimestamp: expect.any(Number)
        })
      );
    });

    it('should save today\'s date in YYYY-MM-DD format', async () => {
      chrome.storage.local.set.mockResolvedValue();
      const today = new Date().toISOString().split('T')[0];
      
      await storage.markDailySolve('test-problem');
      
      const savedData = chrome.storage.local.set.mock.calls[0][0];
      expect(savedData.dailySolveDate).toBe(today);
    });
  });

  describe('clearDailySolve', () => {
    it('should remove daily solve keys from local storage', async () => {
      chrome.storage.local.remove.mockResolvedValue();
      
      await storage.clearDailySolve();
      
      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'dailySolveDate',
        'dailySolveTimestamp',
        'dailySolveProblem',
        'celebrationShownDate'
      ]);
    });
  });

  describe('getBypassState', () => {
    it('should return inactive bypass when no data stored', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      
      const state = await storage.getBypassState();
      
      expect(state.isActive).toBe(false);
      expect(state.remainingMs).toBe(0);
      expect(state.canBypass).toBe(true);
      expect(state.nextAllowedMs).toBe(0);
    });

    it('should return active bypass when current time < bypassUntil', async () => {
      const now = Date.now();
      const bypassUntil = now + 300000; // 5 minutes from now
      chrome.storage.local.get.mockResolvedValue({
        bypassUntil,
        nextBypassAllowed: bypassUntil + 1800000
      });
      
      const state = await storage.getBypassState();
      
      expect(state.isActive).toBe(true);
      expect(state.remainingMs).toBeGreaterThan(0);
      expect(state.canBypass).toBe(false);
    });

    it('should return inactive bypass when current time >= bypassUntil', async () => {
      const now = Date.now();
      const bypassUntil = now - 1000; // 1 second ago
      chrome.storage.local.get.mockResolvedValue({
        bypassUntil,
        nextBypassAllowed: now + 300000
      });
      
      const state = await storage.getBypassState();
      
      expect(state.isActive).toBe(false);
      expect(state.remainingMs).toBe(0);
    });

    it('should calculate canBypass correctly during cooldown', async () => {
      const now = Date.now();
      const nextBypassAllowed = now + 600000; // 10 minutes from now
      chrome.storage.local.get.mockResolvedValue({
        bypassUntil: now - 1000,
        nextBypassAllowed
      });
      
      const state = await storage.getBypassState();
      
      expect(state.canBypass).toBe(false);
      expect(state.nextAllowedMs).toBeGreaterThan(0);
    });

    it('should allow bypass after cooldown expires', async () => {
      const now = Date.now();
      const nextBypassAllowed = now - 1000; // 1 second ago
      chrome.storage.local.get.mockResolvedValue({
        bypassUntil: now - 600000,
        nextBypassAllowed
      });
      
      const state = await storage.getBypassState();
      
      expect(state.canBypass).toBe(true);
      expect(state.nextAllowedMs).toBe(0);
    });
  });

  describe('setBypassState', () => {
    it('should save bypass timestamps to local storage', async () => {
      chrome.storage.local.set.mockResolvedValue();
      const bypassUntil = Date.now() + 600000;
      const nextBypassAllowed = bypassUntil + 1800000;
      
      await storage.setBypassState(bypassUntil, nextBypassAllowed);
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        bypassUntil,
        nextBypassAllowed
      });
    });
  });

  describe('clearBypass', () => {
    it('should remove bypass keys from local storage', async () => {
      chrome.storage.local.remove.mockResolvedValue();
      
      await storage.clearBypass();
      
      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'bypassUntil',
        'nextBypassAllowed'
      ]);
    });
  });
});

