// NeetCode 250 Enforcer - Popup Script with Category Stats

// DOM elements
const progressFill = document.getElementById("progressFill");
const solvedCount = document.getElementById("solvedCount");
const totalCount = document.getElementById("totalCount");
const currentProblemName = document.getElementById("currentProblemName");
const currentCategory = document.getElementById("currentCategory");
const currentDifficulty = document.getElementById("currentDifficulty");
const currentProblemLink = document.getElementById("currentProblemLink");
const dailyStatus = document.getElementById("dailyStatus");
const categoryList = document.getElementById("categoryList");
const toggleCategories = document.getElementById("toggleCategories");
const bypassActive = document.getElementById("bypassActive");
const bypassControls = document.getElementById("bypassControls");
const bypassButton = document.getElementById("bypassButton");
const bypassTimer = document.getElementById("bypassTimer");
const cooldownMessage = document.getElementById("cooldownMessage");
const cooldownTimer = document.getElementById("cooldownTimer");
const refreshButton = document.getElementById("refreshButton");
const optionsButton = document.getElementById("optionsButton");

let bypassInterval = null;
let cooldownInterval = null;
let categoriesExpanded = false;

// Format milliseconds to MM:SS
function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Convert slug to readable name
function slugToName(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Get difficulty color class
function getDifficultyClass(difficulty) {
  if (difficulty === "Easy") return "difficulty-easy";
  if (difficulty === "Medium") return "difficulty-medium";
  if (difficulty === "Hard") return "difficulty-hard";
  return "";
}

// Render category progress bars
function renderCategoryProgress(categoryProgress) {
  if (!categoryProgress || categoryProgress.length === 0) {
    categoryList.innerHTML =
      '<p class="no-data">No category data available</p>';
    return;
  }

  const categoriesToShow = categoriesExpanded
    ? categoryProgress
    : categoryProgress.slice(0, 5);

  categoryList.innerHTML = categoriesToShow
    .map(
      (cat) => `
    <div class="category-item">
      <div class="category-header">
        <span class="category-name">${cat.name}</span>
        <span class="category-count">${cat.solved} / ${cat.total}</span>
      </div>
      <div class="category-progress-bar">
        <div class="category-progress-fill" style="width: ${cat.percentage}%"></div>
      </div>
    </div>
  `
    )
    .join("");

  // Update toggle button
  if (categoryProgress.length > 5) {
    toggleCategories.style.display = "block";
    toggleCategories.textContent = categoriesExpanded
      ? "Show Less"
      : `Show All ${categoryProgress.length} Categories`;
  } else {
    toggleCategories.style.display = "none";
  }
}

// Toggle category expansion
toggleCategories.addEventListener("click", async () => {
  categoriesExpanded = !categoriesExpanded;
  const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  if (response.success) {
    renderCategoryProgress(response.categoryProgress);
  }
});

// Update the UI with current status
async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });

    if (response.success) {
      // Update overall progress
      const progress = (response.solvedCount / response.totalProblems) * 100;
      progressFill.style.width = `${progress}%`;
      solvedCount.textContent = response.solvedCount;
      totalCount.textContent = response.totalProblems;

      // Update current problem
      if (response.currentProblem) {
        const problem = response.currentProblem;
        currentProblemName.textContent = problem.title;
        currentCategory.textContent = response.currentCategory || "Unknown";
        currentDifficulty.textContent = problem.difficulty || "Medium";
        currentDifficulty.className = `problem-difficulty ${getDifficultyClass(
          problem.difficulty
        )}`;
        currentProblemLink.href = `https://leetcode.com/problems/${problem.slug}/`;
      }

      // Update daily solve status
      if (response.dailySolvedToday) {
        dailyStatus.style.display = "block";
      } else {
        dailyStatus.style.display = "none";
      }

      // Render category progress
      renderCategoryProgress(response.categoryProgress);

      // Update bypass status
      updateBypassUI(response.bypass);
    }
  } catch (error) {
    console.error("Failed to get status:", error);
    currentProblemName.textContent = "Error loading status";
  }
}

// Update bypass UI
function updateBypassUI(bypass) {
  if (bypass.isActive) {
    // Show active bypass timer
    bypassActive.style.display = "block";
    bypassControls.style.display = "none";

    // Clear any existing interval
    if (bypassInterval) {
      clearInterval(bypassInterval);
    }

    // Update timer every second
    const updateBypassTimer = () => {
      chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
        if (response.success && response.bypass.isActive) {
          bypassTimer.textContent = formatTime(response.bypass.remainingMs);
        } else {
          // Bypass expired
          bypassActive.style.display = "none";
          bypassControls.style.display = "block";
          if (bypassInterval) {
            clearInterval(bypassInterval);
            bypassInterval = null;
          }
          updateStatus();
        }
      });
    };

    updateBypassTimer();
    bypassInterval = setInterval(updateBypassTimer, 1000);
  } else {
    // Show bypass controls
    bypassActive.style.display = "none";
    bypassControls.style.display = "block";

    if (bypassInterval) {
      clearInterval(bypassInterval);
      bypassInterval = null;
    }

    if (bypass.canBypass) {
      // Can activate bypass
      bypassButton.disabled = false;
      cooldownMessage.style.display = "none";

      if (cooldownInterval) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
      }
    } else {
      // On cooldown
      bypassButton.disabled = true;
      cooldownMessage.style.display = "block";

      // Clear any existing interval
      if (cooldownInterval) {
        clearInterval(cooldownInterval);
      }

      // Update cooldown timer every second
      const updateCooldownTimer = () => {
        chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
          if (response.success) {
            if (response.bypass.canBypass) {
              // Cooldown finished
              cooldownMessage.style.display = "none";
              bypassButton.disabled = false;
              if (cooldownInterval) {
                clearInterval(cooldownInterval);
                cooldownInterval = null;
              }
            } else {
              cooldownTimer.textContent = formatTime(
                response.bypass.nextAllowedMs
              );
            }
          }
        });
      };

      updateCooldownTimer();
      cooldownInterval = setInterval(updateCooldownTimer, 1000);
    }
  }
}

// Handle bypass button click
bypassButton.addEventListener("click", async () => {
  try {
    bypassButton.disabled = true;
    bypassButton.textContent = "Activating...";

    const response = await chrome.runtime.sendMessage({
      type: "ACTIVATE_BYPASS",
    });

    if (response.success) {
      await updateStatus();
    } else {
      alert(`Cannot activate bypass: ${response.reason}`);
      bypassButton.disabled = false;
      bypassButton.textContent = "Start Break (10 min)";
    }
  } catch (error) {
    console.error("Failed to activate bypass:", error);
    alert("Failed to activate bypass");
    bypassButton.disabled = false;
    bypassButton.textContent = "Start Break (10 min)";
  }
});

// Handle refresh button click
refreshButton.addEventListener("click", async () => {
  try {
    refreshButton.disabled = true;
    refreshButton.textContent = "🔄 Refreshing...";

    await chrome.runtime.sendMessage({ type: "REFRESH_STATUS" });
    await updateStatus();

    refreshButton.disabled = false;
    refreshButton.textContent = "🔄 Refresh Status";
  } catch (error) {
    console.error("Failed to refresh:", error);
    refreshButton.disabled = false;
    refreshButton.textContent = "🔄 Refresh Status";
  }
});

// Handle options button click
optionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  updateStatus();

  // Refresh status every 30 seconds
  setInterval(updateStatus, 30000);
});

// Clean up intervals when popup closes
window.addEventListener("unload", () => {
  if (bypassInterval) {
    clearInterval(bypassInterval);
  }
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
  }
});
