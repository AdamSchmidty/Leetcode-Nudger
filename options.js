// Leetcode Buddy - Options Page Script

const ALIASES_PATH = "src/assets/data/problemAliases.json";

// System-enforced domains (not user-editable)
const SYSTEM_EXCLUSION_LIST = [
  "leetcode.com",
  "neetcode.io",
  "accounts.google.com"
];

// Default user-editable exclusion list (examples)
const DEFAULT_USER_EXCLUSION_LIST = [
  "github.com",
  "linkedin.com"
];

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
const exclusionListContainer = document.getElementById("exclusionListContainer");
const exclusionDomainInput = document.getElementById("exclusionDomainInput");
const addExclusionButton = document.getElementById("addExclusionButton");
const resetExclusionButton = document.getElementById("resetExclusionButton");
const exclusionError = document.getElementById("exclusionError");
const exclusionCount = document.getElementById("exclusionCount");

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

// ============================================================================
// EXCLUSION LIST MANAGEMENT
// ============================================================================

/**
 * Validate domain format
 * @param {string} domain - Domain to validate
 * @returns {Object} { valid: boolean, error: string }
 */
function validateDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return { valid: false, error: 'Domain is required' };
  }
  
  const trimmed = domain.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Domain cannot be empty' };
  }
  
  // Basic domain validation regex
  // Allows: subdomain.example.com, example.com, example.co.uk
  // Does not allow: http://, https://, paths, etc.
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-_.]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-_.]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  
  if (!domainRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid domain format. Use format like: example.com' };
  }
  
  return { valid: true, error: null };
}

/**
 * Load user exclusion list from storage
 * @returns {Promise<Array<string>>}
 */
async function loadExclusionList() {
  try {
    const result = await chrome.storage.sync.get(['userExclusionList']);
    let userExclusionList = result.userExclusionList;
    
    // If no exclusion list exists, initialize with defaults
    if (!Array.isArray(userExclusionList) || userExclusionList.length === 0) {
      userExclusionList = [...DEFAULT_USER_EXCLUSION_LIST];
      await saveExclusionList(userExclusionList);
    }
    
    return userExclusionList;
  } catch (error) {
    console.error("Failed to load exclusion list:", error);
    return [...DEFAULT_USER_EXCLUSION_LIST];
  }
}

/**
 * Save user exclusion list to storage
 * @param {Array<string>} userExclusionList - List of user-editable domains
 * @returns {Promise<void>}
 */
async function saveExclusionList(userExclusionList) {
  try {
    await chrome.storage.sync.set({ userExclusionList });
    console.log("User exclusion list saved:", userExclusionList);
    
    // Notify background script to update redirect rule
    await chrome.runtime.sendMessage({ type: "REFRESH_STATUS" });
  } catch (error) {
    console.error("Failed to save exclusion list:", error);
    throw error;
  }
}

/**
 * Render system exclusion list (read-only)
 */
function renderSystemExclusionList() {
  const systemContainer = document.getElementById('systemExclusionList');
  systemContainer.innerHTML = '';
  
  SYSTEM_EXCLUSION_LIST.forEach((domain) => {
    const item = document.createElement('div');
    item.className = 'exclusion-list-item exclusion-list-item-system';
    
    const domainSpan = document.createElement('span');
    domainSpan.className = 'exclusion-domain';
    domainSpan.textContent = domain;
    
    const lockIcon = document.createElement('span');
    lockIcon.className = 'exclusion-lock-icon';
    lockIcon.textContent = '🔒';
    lockIcon.title = 'System domain (required)';
    
    item.appendChild(domainSpan);
    item.appendChild(lockIcon);
    systemContainer.appendChild(item);
  });
}

/**
 * Render user exclusion list UI
 * @param {Array<string>} userExclusionList - List of user-editable domains
 */
function renderExclusionList(userExclusionList) {
  exclusionListContainer.innerHTML = '';
  
  if (userExclusionList.length === 0) {
    exclusionListContainer.innerHTML = '<p class="no-data">No custom domains added. Add domains above to exclude them from redirection.</p>';
    exclusionCount.textContent = '0';
    return;
  }
  
  userExclusionList.forEach((domain, index) => {
    const item = document.createElement('div');
    item.className = 'exclusion-list-item';
    
    const domainSpan = document.createElement('span');
    domainSpan.className = 'exclusion-domain';
    domainSpan.textContent = domain;
    
    const removeButton = document.createElement('button');
    removeButton.className = 'exclusion-remove-button';
    removeButton.textContent = 'Remove';
    removeButton.title = 'Remove this domain';
    removeButton.addEventListener('click', () => removeExclusionDomain(index));
    
    item.appendChild(domainSpan);
    item.appendChild(removeButton);
    exclusionListContainer.appendChild(item);
  });
  
  exclusionCount.textContent = userExclusionList.length.toString();
}

/**
 * Add domain to exclusion list
 */
async function addExclusionDomain() {
  const domain = exclusionDomainInput.value.trim();
  
  // Clear previous errors
  exclusionError.style.display = 'none';
  exclusionError.textContent = '';
  
  // Validate domain
  const validation = validateDomain(domain);
  if (!validation.valid) {
    exclusionError.textContent = validation.error;
    exclusionError.style.display = 'block';
    return;
  }
  
  // Load current list
  const exclusionList = await loadExclusionList();
  
  // Check for duplicates (case-insensitive) - check both user list and system list
  const domainLower = domain.toLowerCase();
  if (exclusionList.some(d => d.toLowerCase() === domainLower)) {
    exclusionError.textContent = 'This domain is already in your exclusion list';
    exclusionError.style.display = 'block';
    return;
  }
  
  // Check against system domains
  if (SYSTEM_EXCLUSION_LIST.some(d => d.toLowerCase() === domainLower)) {
    exclusionError.textContent = 'This domain is already excluded (system domain)';
    exclusionError.style.display = 'block';
    return;
  }
  
  // Check max limit
  if (exclusionList.length >= 10) {
    exclusionError.textContent = 'Maximum of 10 domains allowed';
    exclusionError.style.display = 'block';
    return;
  }
  
  // Add domain
  exclusionList.push(domain);
  await saveExclusionList(exclusionList);
  
  // Update UI
  renderExclusionList(exclusionList);
  exclusionDomainInput.value = '';
}

/**
 * Remove domain from exclusion list
 * @param {number} index - Index of domain to remove
 */
async function removeExclusionDomain(index) {
  const exclusionList = await loadExclusionList();
  
  if (index >= 0 && index < exclusionList.length) {
    exclusionList.splice(index, 1);
    await saveExclusionList(exclusionList);
    renderExclusionList(exclusionList);
  }
}

/**
 * Reset exclusion list to defaults
 */
async function resetExclusionList() {
  if (!confirm('Reset to default domains? This will replace your current custom domains with: ' + DEFAULT_USER_EXCLUSION_LIST.join(', '))) {
    return;
  }
  
  const defaultList = [...DEFAULT_USER_EXCLUSION_LIST];
  await saveExclusionList(defaultList);
  renderExclusionList(defaultList);
  
  // Clear any errors
  exclusionError.style.display = 'none';
  exclusionError.textContent = '';
}

/**
 * Initialize exclusion list UI
 */
async function initializeExclusionList() {
  // Render system domains (read-only)
  renderSystemExclusionList();
  
  // Load and render user domains
  const userExclusionList = await loadExclusionList();
  renderExclusionList(userExclusionList);
  
  // Add event listeners
  addExclusionButton.addEventListener('click', addExclusionDomain);
  resetExclusionButton.addEventListener('click', resetExclusionList);
  
  // Allow Enter key to add domain
  exclusionDomainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addExclusionDomain();
    }
  });
  
  // Clear error on input
  exclusionDomainInput.addEventListener('input', () => {
    if (exclusionError.style.display === 'block') {
      exclusionError.style.display = 'none';
    }
  });
}

// Initialize on load
document.addEventListener("DOMContentLoaded", async () => {
  await loadAliases();
  loadSettings();
  renderCategoryAccordion();
  await initializeExclusionList();
  
  // Listen for storage changes (e.g., when daily problem is solved)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.dailySolveDate) {
      // Daily problem solved, refresh the display to show updated progress
      loadSettings();
      renderCategoryAccordion();
    }
    if (areaName === 'sync' && changes.userExclusionList) {
      // User exclusion list changed, refresh UI
      loadExclusionList().then(renderExclusionList);
    }
  });
});

