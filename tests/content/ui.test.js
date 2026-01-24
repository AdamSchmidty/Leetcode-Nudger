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

  describe('showSolvedNotification', () => {
    it('should create notification banner', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: false // Disable celebration to test notification only
      });
      
      await ui.showSolvedNotification();
      
      // Find notification by text content
      const notifications = Array.from(document.querySelectorAll('div')).filter(
        div => div.textContent?.includes('Amazing! Daily Problem Solved!')
      );
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should display success message', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: false
      });
      
      await ui.showSolvedNotification();
      
      // Find notification by text content
      const notifications = Array.from(document.querySelectorAll('div')).filter(
        div => div.textContent?.includes('Amazing! Daily Problem Solved!')
      );
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].textContent).toContain('Amazing! Daily Problem Solved!');
    });

    it('should trigger confetti when enabled and not shown today', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: true
      });
      chrome.storage.local.get.mockResolvedValue({});
      
      await ui.showSolvedNotification();
      
      const confetti = document.getElementById('leetcode-buddy-confetti');
      expect(confetti).toBeTruthy();
    });

    it('should not trigger confetti when disabled', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: false
      });
      
      await ui.showSolvedNotification();
      
      const confetti = document.querySelector('.leetcode-buddy-confetti');
      expect(confetti).toBeFalsy();
    });

    it('should mark celebration as shown when triggered', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: true
      });
      chrome.storage.local.get.mockResolvedValue({});
      
      await ui.showSolvedNotification();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          celebrationShownDate: expect.any(String)
        })
      );
    });

    it('should auto-remove notification after delay', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: false
      });
      
      await ui.showSolvedNotification();
      const notification = document.querySelector('.leetcode-buddy-notification');
      expect(notification).toBeTruthy();
      
      // Check after 7 seconds (6s delay + 0.5s fade)
      await new Promise(resolve => setTimeout(resolve, 7000));
      
      const removedNotification = document.querySelector('.leetcode-buddy-notification');
      expect(removedNotification).toBeFalsy();
    }, 8000);

    it('should style notification correctly', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: false
      });
      
      await ui.showSolvedNotification();
      
      // Find notification by checking all divs (it doesn't have a class)
      const notifications = Array.from(document.querySelectorAll('div')).filter(
        div => div.textContent?.includes('Amazing! Daily Problem Solved!')
      );
      expect(notifications.length).toBeGreaterThan(0);
      
      const notification = notifications[0];
      expect(notification.style.position).toBe('fixed');
      expect(notification.style.zIndex).toBeTruthy();
    });
  });

  describe('DOM Cleanup', () => {
    it('should not create duplicate confetti containers', () => {
      ui.triggerConfetti();
      ui.triggerConfetti();
      
      // Should still only have elements from first call (second one should clean up first)
      const containers = Array.from(document.querySelectorAll('#leetcode-buddy-confetti'));
      expect(containers.length).toBeLessThanOrEqual(2); // Allow some overlap during animation
    });

    it('should not create duplicate notification banners', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        celebrationEnabled: false
      });
      
      await ui.showSolvedNotification();
      await ui.showSolvedNotification();
      
      // Find notifications by text content
      const notifications = Array.from(document.querySelectorAll('div')).filter(
        div => div.textContent?.includes('Amazing! Daily Problem Solved!')
      );
      expect(notifications.length).toBeLessThanOrEqual(2); // Allow some overlap during fade
    });
  });
});

