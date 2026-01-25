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

    it('should return state from storage with positions', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        positions: {
          neetcode250: { categoryIndex: 2, problemIndex: 5 }
        },
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

    it('should migrate old format to new format', async () => {
      chrome.storage.sync.get
        .mockResolvedValueOnce({
          currentCategoryIndex: 3,
          currentProblemIndex: 7,
          solvedProblems: ['problem1'],
          selectedProblemSet: 'neetcode250'
        })
        .mockResolvedValueOnce({
          positions: {
            neetcode250: { categoryIndex: 3, problemIndex: 7 }
          },
          solvedProblems: ['problem1'],
          selectedProblemSet: 'neetcode250'
        });
      chrome.storage.sync.set.mockResolvedValue();
      chrome.storage.sync.remove.mockResolvedValue();
      
      const state = await storage.getState();
      
      // Should migrate and return position from migrated data
      expect(chrome.storage.sync.set).toHaveBeenCalled();
      expect(chrome.storage.sync.remove).toHaveBeenCalledWith(['currentCategoryIndex', 'currentProblemIndex']);
      expect(state.currentCategoryIndex).toBe(3);
      expect(state.currentProblemIndex).toBe(7);
    });

    it('should convert solvedProblems array to Set', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        positions: {},
        solvedProblems: ['problem1', 'problem2', 'problem3']
      });
      
      const state = await storage.getState();
      
      expect(state.solvedProblems).toBeInstanceOf(Set);
      expect(state.solvedProblems.size).toBe(3);
    });
  });

  describe('saveState', () => {
    it('should save state to chrome.storage.sync with per-set positions', async () => {
      chrome.storage.sync.set.mockResolvedValue();
      chrome.storage.sync.get.mockResolvedValue({ selectedProblemSet: 'neetcode250' });
      const solvedProblems = new Set(['two-sum', 'valid-anagram']);
      
      await storage.saveState(1, 3, solvedProblems);
      
      // Should call set twice: once for position, once for solved problems
      expect(chrome.storage.sync.set).toHaveBeenCalledTimes(2);
      // Check that solved problems are saved
      const solvedProblemsCall = chrome.storage.sync.set.mock.calls.find(call => 
        call[0].solvedProblems
      );
      expect(solvedProblemsCall[0].solvedProblems).toEqual(['two-sum', 'valid-anagram']);
    });

    it('should save position for specific problem set', async () => {
      chrome.storage.sync.set.mockResolvedValue();
      chrome.storage.sync.get.mockResolvedValue({ selectedProblemSet: 'blind75' });
      const solvedProblems = new Set(['a', 'b', 'c']);
      
      await storage.saveState(2, 5, solvedProblems, 'blind75');
      
      // Should save position for blind75
      const positionCall = chrome.storage.sync.set.mock.calls.find(call => 
        call[0].positions && call[0].positions.blind75
      );
      expect(positionCall[0].positions.blind75).toEqual({ categoryIndex: 2, problemIndex: 5 });
    });

    it('should convert Set to array for storage', async () => {
      chrome.storage.sync.set.mockResolvedValue();
      chrome.storage.sync.get.mockResolvedValue({ selectedProblemSet: 'neetcode250' });
      const solvedProblems = new Set(['a', 'b', 'c']);
      
      await storage.saveState(0, 0, solvedProblems);
      
      const solvedProblemsCall = chrome.storage.sync.set.mock.calls.find(call => 
        call[0].solvedProblems
      );
      expect(Array.isArray(solvedProblemsCall[0].solvedProblems)).toBe(true);
      expect(solvedProblemsCall[0].solvedProblems.length).toBe(3);
    });
  });

  describe('getPositionForSet', () => {
    it('should return default position 0,0 when set not found', async () => {
      chrome.storage.sync.get.mockResolvedValue({ positions: {} });
      
      const position = await storage.getPositionForSet('blind75');
      
      expect(position.categoryIndex).toBe(0);
      expect(position.problemIndex).toBe(0);
    });

    it('should return position for existing set', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        positions: {
          blind75: { categoryIndex: 2, problemIndex: 5 }
        }
      });
      
      const position = await storage.getPositionForSet('blind75');
      
      expect(position.categoryIndex).toBe(2);
      expect(position.problemIndex).toBe(5);
    });
  });

  describe('savePositionForSet', () => {
    it('should save position for a specific set', async () => {
      chrome.storage.sync.get.mockResolvedValue({ positions: {} });
      chrome.storage.sync.set.mockResolvedValue();
      
      await storage.savePositionForSet('neetcode150', 3, 7);
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        positions: {
          neetcode150: { categoryIndex: 3, problemIndex: 7 }
        }
      });
    });

    it('should preserve existing positions when saving new one', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        positions: {
          blind75: { categoryIndex: 1, problemIndex: 2 }
        }
      });
      chrome.storage.sync.set.mockResolvedValue();
      
      await storage.savePositionForSet('neetcode150', 3, 7);
      
      const savedPositions = chrome.storage.sync.set.mock.calls[0][0].positions;
      expect(savedPositions.blind75).toEqual({ categoryIndex: 1, problemIndex: 2 });
      expect(savedPositions.neetcode150).toEqual({ categoryIndex: 3, problemIndex: 7 });
    });
  });

  describe('resetAllPositions', () => {
    it('should reset all positions to 0,0 for all sets', async () => {
      chrome.storage.sync.set.mockResolvedValue();
      
      await storage.resetAllPositions();
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        positions: {
          blind75: { categoryIndex: 0, problemIndex: 0 },
          neetcode150: { categoryIndex: 0, problemIndex: 0 },
          neetcode250: { categoryIndex: 0, problemIndex: 0 },
          neetcodeAll: { categoryIndex: 0, problemIndex: 0 }
        }
      });
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

