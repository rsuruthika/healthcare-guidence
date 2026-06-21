const API_BASE = window.MB_API_BASE || "http://localhost:3000";

function token() {
  return localStorage.getItem("mindbridge_token");
}

function setStatus(message, isError = false) {
  const status = document.getElementById("adminStatus");
  status.textContent = message;
  status.style.color = isError ? "#b91c1c" : "#0f766e";
}

function renderList(elementId, items, formatter) {
  const container = document.getElementById(elementId);
  if (!items || !items.length) {
    container.innerHTML = "<p class='muted'>No data.</p>";
    return;
  }
  container.innerHTML = `<ul>${items.map(formatter).join("")}</ul>`;
}

async function loadAdminAnalytics() {
  const sessionToken = token();
  if (!sessionToken) {
    setStatus("No session found. Please login as admin.", true);
    return;
  }

  setStatus("Loading admin analytics...");
  try {
    const response = await fetch(`${API_BASE}/admin/analytics`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unauthorized access");
    }

    const overviewEntries = Object.entries(data.overview || {});
    renderList("overviewList", overviewEntries, ([key, value]) => `<li><strong>${key}</strong>: ${value}</li>`);

    const analyticsEntries = Object.entries(data.analytics || {});
    renderList("analyticsList", analyticsEntries, ([key, value]) => `<li><strong>${key}</strong>: ${value}</li>`);

    renderList(
      "feedbackList",
      data.latestFeedback || [],
      (item) => `<li><strong>${item.source}</strong> - ${new Date(item.time).toLocaleString()}<br>${item.feedback}</li>`
    );

    renderList(
      "moodList",
      data.latestMoods || [],
      (item) => `<li>${new Date(item.time).toLocaleString()} - <strong>${item.mood}</strong></li>`
    );

    setStatus("Analytics loaded.");
  } catch (error) {
    setStatus(error.message || "Could not load admin analytics.", true);
  }
}

document.getElementById("refreshBtn").addEventListener("click", loadAdminAnalytics);
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("mindbridge_token");
  localStorage.removeItem("mindbridge_user");
  setStatus("Logged out. Redirecting to login...");
  setTimeout(() => {
    window.location.href = "login.html";
  }, 700);
});

document.addEventListener("DOMContentLoaded", loadAdminAnalytics);
