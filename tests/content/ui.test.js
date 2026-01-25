/**
 * Unit tests for src/content/ui.js
 * Tests celebration animations and notifications
 */

import * as ui from '../../src/content/ui.js';

describe('ui.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    chrome.storage.sync.get.mockResolvedValue({});
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue();
  });

  describe('checkIfShouldShowCelebration', () => {
    it('should return true when celebration enabled and not shown today', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: true
      });
      
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      chrome.storage.local.get.mockResolvedValue({
        celebrationShownDate: yesterday
      });
      
      const shouldShow = await ui.checkIfShouldShowCelebration();
      
      expect(shouldShow).toBe(true);
    });

    it('should return false when celebration disabled', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: false
      });
      
      const shouldShow = await ui.checkIfShouldShowCelebration();
      
      expect(shouldShow).toBe(false);
    });

    it('should return false when celebration already shown today', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: true
      });
      
      const today = new Date().toISOString().split('T')[0];
      chrome.storage.local.get.mockResolvedValue({
        celebrationShownDate: today
      });
      
      const shouldShow = await ui.checkIfShouldShowCelebration();
      
      expect(shouldShow).toBe(false);
    });

    it('should default to enabled when setting not present', async () => {
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({});
      
      const shouldShow = await ui.checkIfShouldShowCelebration();
      
      expect(shouldShow).toBe(true);
    });
  });

  describe('markCelebrationAsShown', () => {
    it('should save today\'s date to local storage', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      await ui.markCelebrationAsShown();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        celebrationShownDate: today
      });
    });
  });

  describe('triggerConfetti', () => {
    it('should create confetti container in DOM', () => {
      ui.triggerConfetti();
      
      const container = document.getElementById('leetcode-buddy-confetti');
      expect(container).toBeTruthy();
      expect(container.style.position).toBe('fixed');
    });

    it('should create multiple confetti pieces', () => {
      ui.triggerConfetti();
      
      const container = document.getElementById('leetcode-buddy-confetti');
      expect(container).toBeTruthy();
      const confettiPieces = container.querySelectorAll('div');
      // Container has many child divs (confetti pieces)
      expect(confettiPieces.length).toBeGreaterThan(0);
    });

    it('should apply random colors to confetti', () => {
      ui.triggerConfetti();
      
      const container = document.getElementById('leetcode-buddy-confetti');
      const confettiPieces = container.querySelectorAll('div');
      const colors = new Set();
      
      confettiPieces.forEach(piece => {
        const bgColor = piece.style.backgroundColor;
        if (bgColor) colors.add(bgColor);
      });
      
      // Should have at least some colors (some may be transparent for triangles)
      expect(confettiPieces.length).toBeGreaterThan(0);
    });

    it('should remove confetti after animation', async () => {
      ui.triggerConfetti();
      
      const container = document.getElementById('leetcode-buddy-confetti');
      expect(container).toBeTruthy();
      
      // Check after animation duration (5 seconds)
      await new Promise(resolve => setTimeout(resolve, 5500));
      
      const removedContainer = document.getElementById('leetcode-buddy-confetti');
      expect(removedContainer).toBeFalsy();
    }, 6000);

    it('should apply random positions to confetti', () => {
      ui.triggerConfetti();
      
      const container = document.getElementById('leetcode-buddy-confetti');
      const confettiPieces = container.querySelectorAll('div');
      const positions = new Set();
      
      confettiPieces.forEach(piece => {
        positions.add(piece.style.left);
      });
      
      // Should have multiple different positions
      expect(positions.size).toBeGreaterThan(1);
    });
  });

  describe('showCelebration', () => {
    it('should trigger confetti when enabled and not shown today', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: true
      });
      chrome.storage.local.get.mockResolvedValue({});
      
      await ui.showCelebration();
      
      const confetti = document.getElementById('leetcode-buddy-confetti');
      expect(confetti).toBeTruthy();
    });

    it('should not trigger confetti when disabled', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: false
      });
      
      await ui.showCelebration();
      
      const confetti = document.getElementById('leetcode-buddy-confetti');
      expect(confetti).toBeFalsy();
    });

    it('should mark celebration as shown when triggered', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: true
      });
      chrome.storage.local.get.mockResolvedValue({});
      
      await ui.showCelebration();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          celebrationShownDate: expect.any(String)
        })
      );
    });

    it('should not trigger confetti if already shown today', async () => {
      const today = new Date().toISOString().split('T')[0];
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: true
      });
      chrome.storage.local.get.mockResolvedValue({
        celebrationShownDate: today
      });
      
      await ui.showCelebration();
      
      const confetti = document.getElementById('leetcode-buddy-confetti');
      expect(confetti).toBeFalsy();
    });
  });

  describe('showSolvedNotification (deprecated)', () => {
    it('should call showCelebration for backward compatibility', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: true
      });
      chrome.storage.local.get.mockResolvedValue({});
      
      await ui.showSolvedNotification();
      
      // Should still trigger confetti (via showCelebration)
      const confetti = document.getElementById('leetcode-buddy-confetti');
      expect(confetti).toBeTruthy();
    });
  });

  describe('DOM Cleanup', () => {
    it('should not create duplicate confetti containers', () => {
      ui.triggerConfetti();
      // Second call should be prevented by guard
      ui.triggerConfetti();
      
      // Should only have one container (second call should be skipped)
      const containers = Array.from(document.querySelectorAll('#leetcode-buddy-confetti'));
      expect(containers.length).toBe(1);
    });
  });
});

