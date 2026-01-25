// Leetcode Buddy - Options Page Script

const ALIASES_PATH = "src/assets/data/problemAliases.json";

const problemSetSelect = document.getElementById("problemSetSelect");
const totalProblems = document.getElementById("totalProblems");
const totalCategories = document.getElementById("totalCategories");
const yourProgress = document.getElementById("yourProgress");
const resetButton = document.getElementById("resetButton");
const resetConfirm = document.getElementById("resetConfirm");
const confirmReset = document.getElementById("confirmReset");
const cancelReset = document.getElementById("cancelReset");
const celebrationToggle = document.getElementById("celebrationToggle");
const sortByDifficultyToggle = document.getElementById("sortByDifficultyToggle");
const clearEditorOnFirstOpenToggle = document.getElementById("clearEditorOnFirstOpenToggle");
const randomProblemSelectionToggle = document.getElementById("randomProblemSelectionToggle");

// Load aliases for NeetCode URL resolution
let problemAliases = {};

async function loadAliases() {
  try {
    const response = await fetch(chrome.runtime.getURL(ALIASES_PATH));
    problemAliases = await response.json();
    return problemAliases;
  } catch (error) {
    console.error("Failed to load aliases:", error);
    return {};
  }
}

// Find alias for a canonical slug (reverse lookup)
function findAliasForSlug(canonicalSlug) {
  for (const [alias, canonical] of Object.entries(problemAliases)) {
    if (canonical === canonicalSlug) {
      return alias;
    }
  }
  return null;
}

// Get NeetCode slug for URL
function getNeetCodeSlug(slug) {
  // First check if the slug itself is an alias
  if (problemAliases[slug]) {
    return slug;
  }
  
  // Check if there's an alias for this canonical slug
  const alias = findAliasForSlug(slug);
  if (alias) {
    return alias;
  }
  
  // No alias found, use original slug
  return slug;
}

// Get NeetCode solution URL
function getNeetCodeUrl(slug) {
  const neetcodeSlug = getNeetCodeSlug(slug);
  return `https://neetcode.io/solutions/${neetcodeSlug}`;
}

// Sort problems by difficulty
function sortProblemsByDifficulty(problems) {
  const difficultyOrder = { Easy: 0, Medium: 1, Hard: 2 };
  
  return [...problems].sort((a, b) => {
    const diffA = difficultyOrder[a.difficulty] ?? 999;
    const diffB = difficultyOrder[b.difficulty] ?? 999;
    return diffA - diffB;
  });
}

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
      const result = await chrome.storage.sync.get([
        "selectedProblemSet",
        "celebrationEnabled",
        "sortByDifficulty",
        "clearEditorOnFirstOpen",
        "randomProblemSelection"
      ]);
      const selectedSet = result.selectedProblemSet || "neetcode250";
      problemSetSelect.value = selectedSet;
      
      // Load celebration toggle setting (default: true)
      const celebrationEnabled = result.celebrationEnabled !== false;
      celebrationToggle.checked = celebrationEnabled;
      
      // Load sort by difficulty toggle setting (default: false)
      const sortByDifficulty = result.sortByDifficulty === true;
      sortByDifficultyToggle.checked = sortByDifficulty;
      
      // Load clear editor on first open toggle setting (default: false)
      const clearEditorOnFirstOpen = result.clearEditorOnFirstOpen === true;
      clearEditorOnFirstOpenToggle.checked = clearEditorOnFirstOpen;
      
      // Load random problem selection toggle setting (default: false)
      const randomProblemSelection = result.randomProblemSelection === true;
      randomProblemSelectionToggle.checked = randomProblemSelection;
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

    // Refresh status first to recompute next problem for new set
    await chrome.runtime.sendMessage({ type: "REFRESH_STATUS" });

    // Reload settings to get updated totals and progress
    await loadSettings();
    
    // Refresh category accordion to show new problem set
    await renderCategoryAccordion();
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

// Handle celebration toggle
celebrationToggle.addEventListener("change", async () => {
  const enabled = celebrationToggle.checked;
  
  try {
    await chrome.storage.sync.set({ celebrationEnabled: enabled });
    console.log("Celebration animations:", enabled ? "enabled" : "disabled");
  } catch (error) {
    console.error("Failed to save celebration setting:", error);
  }
});

// Handle sort by difficulty toggle
sortByDifficultyToggle.addEventListener("change", async () => {
  const enabled = sortByDifficultyToggle.checked;
  
  try {
    await chrome.storage.sync.set({ sortByDifficulty: enabled });
    console.log("Sort by difficulty:", enabled ? "enabled" : "disabled");
    
    // Recompute next problem to reflect the new ordering
    await chrome.runtime.sendMessage({ type: "REFRESH_STATUS" });
    
    // Re-render category accordion with new sorting
    await renderCategoryAccordion();
    
    // Reload settings to show updated current problem
    await loadSettings();
  } catch (error) {
    console.error("Failed to save sort by difficulty setting:", error);
  }
});

// Handle clear editor on first open toggle
clearEditorOnFirstOpenToggle.addEventListener("change", async () => {
  const enabled = clearEditorOnFirstOpenToggle.checked;
  
  try {
    await chrome.storage.sync.set({ clearEditorOnFirstOpen: enabled });
    console.log("Clear editor on first open:", enabled ? "enabled" : "disabled");
  } catch (error) {
    console.error("Failed to save clear editor on first open setting:", error);
  }
});

// Handle random problem selection toggle
randomProblemSelectionToggle.addEventListener("change", async () => {
  const enabled = randomProblemSelectionToggle.checked;
  
  try {
    await chrome.storage.sync.set({ randomProblemSelection: enabled });
    console.log("Random problem selection:", enabled ? "enabled" : "disabled");
    
    // Recompute next problem to reflect the new selection mode
    await chrome.runtime.sendMessage({ type: "REFRESH_STATUS" });
    
    // Reload settings to show updated current problem
    await loadSettings();
  } catch (error) {
    console.error("Failed to save random problem selection setting:", error);
  }
});

// Render category accordion
async function renderCategoryAccordion() {
  const container = document.getElementById('categoryAccordion');
  
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_DETAILED_PROGRESS" });
    
    if (!response.success || !response.categories) {
      container.innerHTML = '<p class="loading-message">Failed to load categories</p>';
      return;
    }
    
    container.innerHTML = '';
    
    response.categories.forEach(category => {
      const item = createCategoryAccordionItem(category);
      container.appendChild(item);
    });
  } catch (error) {
    console.error("Failed to render category accordion:", error);
    container.innerHTML = '<p class="loading-message">Error loading categories</p>';
  }
}

// Create a single category accordion item
function createCategoryAccordionItem(category) {
  const div = document.createElement('div');
  div.className = 'category-accordion-item';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'category-header';
  
  const nameSection = document.createElement('div');
  nameSection.className = 'category-name-section';
  
  const nameStrong = document.createElement('strong');
  nameStrong.textContent = category.name;
  
  const progressSpan = document.createElement('span');
  progressSpan.className = 'category-progress';
  progressSpan.textContent = `${category.solved}/${category.total}`;
  
  nameSection.appendChild(nameStrong);
  nameSection.appendChild(progressSpan);
  
  const chevron = document.createElement('div');
  chevron.className = 'category-chevron';
  chevron.textContent = '▼';
  
  header.appendChild(nameSection);
  header.appendChild(chevron);
  
  // Create content container
  const content = document.createElement('div');
  content.className = 'category-content';
  
  // Add problems (already sorted by message handler if needed)
  category.problems.forEach(problem => {
    const problemDiv = document.createElement('div');
    problemDiv.className = `problem-item ${problem.isCurrent ? 'problem-current' : ''}`;
    
    const statusDiv = document.createElement('div');
    statusDiv.className = `problem-status ${problem.solved ? 'solved' : 'unsolved'}`;
    statusDiv.textContent = problem.solved ? '✓' : '○';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'problem-title';
    
    const link = document.createElement('a');
    link.href = `https://leetcode.com/problems/${problem.slug}/`;
    link.target = '_blank';
    link.textContent = problem.title;
    
    titleDiv.appendChild(link);
    
    const difficultyDiv = document.createElement('div');
    difficultyDiv.className = `problem-difficulty difficulty-${problem.difficulty.toLowerCase()}`;
    difficultyDiv.textContent = problem.difficulty;
    
    // Add NeetCode video icon
    const videoLink = document.createElement('a');
    videoLink.href = getNeetCodeUrl(problem.slug);
    videoLink.target = '_blank';
    videoLink.className = 'neetcode-video-link';
    videoLink.title = 'View NeetCode solution';
    videoLink.innerHTML = '▶️';
    
    problemDiv.appendChild(statusDiv);
    problemDiv.appendChild(titleDiv);
    problemDiv.appendChild(difficultyDiv);
    problemDiv.appendChild(videoLink);
    
    content.appendChild(problemDiv);
  });
  
  // Add click handler to toggle
  header.addEventListener('click', () => {
    content.classList.toggle('expanded');
    chevron.classList.toggle('expanded');
  });
  
  div.appendChild(header);
  div.appendChild(content);
  
  return div;
}

// Initialize on load
document.addEventListener("DOMContentLoaded", async () => {
  await loadAliases();
  loadSettings();
  renderCategoryAccordion();
  
  // Listen for storage changes (e.g., when daily problem is solved)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.dailySolveDate) {
      // Daily problem solved, refresh the display to show updated progress
      loadSettings();
      renderCategoryAccordion();
    }
  });
});

