// Leetcode Buddy - Options Page Script

const problemSetSelect = document.getElementById("problemSetSelect");
const totalProblems = document.getElementById("totalProblems");
const totalCategories = document.getElementById("totalCategories");
const yourProgress = document.getElementById("yourProgress");
const resetButton = document.getElementById("resetButton");
const resetConfirm = document.getElementById("resetConfirm");
const confirmReset = document.getElementById("confirmReset");
const cancelReset = document.getElementById("cancelReset");

// Load current settings
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });

    if (response.success) {
      // Update progress display
      totalProblems.textContent = response.totalProblems || 250;
      totalCategories.textContent = response.categoryProgress?.length || 18;
      yourProgress.textContent = `${response.solvedCount} / ${response.totalProblems}`;

      // Load selected problem set
      const result = await chrome.storage.sync.get(["selectedProblemSet"]);
      const selectedSet = result.selectedProblemSet || "neetcode250";
      problemSetSelect.value = selectedSet;
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

// Save problem set selection
problemSetSelect.addEventListener("change", async () => {
  const selectedSet = problemSetSelect.value;

  try {
    await chrome.storage.sync.set({ selectedProblemSet: selectedSet });
    console.log("Problem set changed to:", selectedSet);

    // Refresh status
    await chrome.runtime.sendMessage({ type: "REFRESH_STATUS" });

    // Reload settings
    await loadSettings();
  } catch (error) {
    console.error("Failed to save problem set:", error);
  }
});

// Show reset confirmation
resetButton.addEventListener("click", () => {
  resetConfirm.style.display = "block";
  resetButton.style.display = "none";
});

// Cancel reset
cancelReset.addEventListener("click", () => {
  resetConfirm.style.display = "none";
  resetButton.style.display = "block";
});

// Confirm reset
confirmReset.addEventListener("click", async () => {
  try {
    // Send reset message to background script
    const response = await chrome.runtime.sendMessage({ type: "RESET_PROGRESS" });
    
    if (response.success) {
      // Reload settings
      await loadSettings();

      // Hide confirmation
      resetConfirm.style.display = "none";
      resetButton.style.display = "block";

      alert("Progress reset successfully!");
    } else {
      throw new Error(response.error || "Reset failed");
    }
  } catch (error) {
    console.error("Failed to reset progress:", error);
    alert("Failed to reset progress. Please try again.");
  }
});

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
});

