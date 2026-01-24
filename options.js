// Leetcode Buddy - Options Page Script

const problemSetSelect = document.getElementById("problemSetSelect");
const totalProblems = document.getElementById("totalProblems");
const totalCategories = document.getElementById("totalCategories");
const yourProgress = document.getElementById("yourProgress");
const resetButton = document.getElementById("resetButton");
const resetConfirm = document.getElementById("resetConfirm");
const confirmReset = document.getElementById("confirmReset");
const cancelReset = document.getElementById("cancelReset");
const celebrationToggle = document.getElementById("celebrationToggle");

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
        "celebrationEnabled"
      ]);
      const selectedSet = result.selectedProblemSet || "neetcode250";
      problemSetSelect.value = selectedSet;
      
      // Load celebration toggle setting (default: true)
      const celebrationEnabled = result.celebrationEnabled !== false;
      celebrationToggle.checked = celebrationEnabled;
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
  
  // Add problems
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
    
    problemDiv.appendChild(statusDiv);
    problemDiv.appendChild(titleDiv);
    problemDiv.appendChild(difficultyDiv);
    
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
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  renderCategoryAccordion();
});

