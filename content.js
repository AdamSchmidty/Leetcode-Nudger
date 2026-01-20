// NeetCode 250 Enforcer - Content Script for LeetCode
// Runs on leetcode.com/problems/* pages to detect successful submissions

let problemAliases = {};

// Load problem aliases
async function loadAliases() {
  try {
    const response = await fetch(chrome.runtime.getURL("problemAliases.json"));
    problemAliases = await response.json();
    return problemAliases;
  } catch (error) {
    console.error("Failed to load aliases:", error);
    return {};
  }
}

// Resolve alias to canonical slug
function resolveAlias(slug) {
  return problemAliases[slug] || slug;
}

// Extract current problem slug from URL
function getCurrentSlug() {
  const match = window.location.pathname.match(/^\/problems\/([^/]+)\/?/);
  return match ? match[1] : null;
}

// Get CSRF token from cookies
function getCsrfToken() {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : "";
}

// Query LeetCode GraphQL API for problem status
async function queryProblemStatus(slug) {
  try {
    const query = `
      query questionStatus($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          status
        }
      }
    `;

    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrftoken": getCsrfToken(),
        Referer: window.location.href,
      },
      credentials: "include",
      body: JSON.stringify({
        query,
        variables: { titleSlug: slug },
      }),
    });

    const data = await response.json();
    return data?.data?.question?.status || null;
  } catch (error) {
    console.error("Failed to query problem status:", error);
    return null;
  }
}

// Check if the current problem is solved and notify background
async function checkAndNotify() {
  const slug = getCurrentSlug();
  if (!slug) {
    console.log("No problem slug found in URL");
    return;
  }

  // Resolve alias to canonical slug
  const canonicalSlug = resolveAlias(slug);
  console.log("Checking status for problem:", slug, "->", canonicalSlug);

  const status = await queryProblemStatus(canonicalSlug);

  console.log("Problem status:", status);

  if (status === "ac") {
    console.log("Problem is solved! Notifying background...");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "PROBLEM_SOLVED",
        slug: canonicalSlug,
      });
      console.log("Background response:", response);

      if (response.dailySolved) {
        // Show notification
        showSolvedNotification();
      }
    } catch (error) {
      console.error("Failed to notify background:", error);
    }
  }
}

// Show a notification when problem is solved
function showSolvedNotification() {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 20px 24px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 16px;
    font-weight: 600;
    max-width: 350px;
  `;
  notification.innerHTML = `
    <div style="margin-bottom: 8px; font-size: 24px;">🎉</div>
    <div>Daily Problem Solved!</div>
    <div style="font-size: 14px; font-weight: 400; opacity: 0.95; margin-top: 6px;">
      All websites unblocked until midnight. Great work!
    </div>
  `;

  document.body.appendChild(notification);

  // Remove notification after 5 seconds
  setTimeout(() => {
    notification.style.transition = "opacity 0.5s";
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 500);
  }, 5000);
}

// Monitor for successful submissions
let lastPathname = window.location.pathname;
let checkTimeout = null;
let hasCheckedOnLoad = false;

// Watch for DOM changes that indicate a submission result
const observer = new MutationObserver((mutations) => {
  // Look for success indicators in the DOM
  const successElements = document.querySelectorAll(
    '[data-e2e-locator="submission-result"]'
  );

  for (const element of successElements) {
    const text = element.textContent || "";
    if (text.includes("Accepted") || text.includes("Success")) {
      console.log("Detected successful submission!");

      // Clear any pending check
      if (checkTimeout) {
        clearTimeout(checkTimeout);
      }

      // Check status after a short delay to let LeetCode update the backend
      checkTimeout = setTimeout(() => {
        checkAndNotify();
      }, 2000);

      break;
    }
  }
});

// Start observing the document for changes
observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Check periodically if URL changed (client-side navigation)
setInterval(() => {
  if (window.location.pathname !== lastPathname) {
    console.log("URL changed, checking new problem...");
    lastPathname = window.location.pathname;
    hasCheckedOnLoad = false;

    // Check after a delay to let the page load
    setTimeout(() => {
      if (!hasCheckedOnLoad) {
        checkAndNotify();
        hasCheckedOnLoad = true;
      }
    }, 3000);
  }
}, 1000);

// Initial check when content script loads
(async () => {
  await loadAliases();
  
  setTimeout(() => {
    if (!hasCheckedOnLoad) {
      console.log("Initial problem status check...");
      checkAndNotify();
      hasCheckedOnLoad = true;
    }
  }, 3000);
})();

// Listen for visibility changes (tab becomes active)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    console.log("Tab became visible, checking status...");
    setTimeout(checkAndNotify, 1000);
  }
});

console.log(
  "NeetCode 250 Enforcer content script loaded on:",
  window.location.href
);
