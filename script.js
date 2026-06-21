const API_BASE = window.MB_API_BASE || "http://localhost:3000";

function setStatus(message, isError = false) {
  const status = document.getElementById("action-status");
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "#b91c1c" : "#0f766e";
}

function getAuthToken() {
  return localStorage.getItem("mindbridge_token");
}

async function apiFetch(endpoint, options = {}) {
  const headers = options.headers || {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });
}

async function loadAuthBadge() {
  const badge = document.getElementById("user-badge");
  if (!badge) return;

  const token = getAuthToken();
  if (!token) {
    badge.textContent = "Not logged in.";
    return;
  }

  try {
    const response = await apiFetch("/auth/me");
    if (!response.ok) throw new Error("invalid session");
    const data = await response.json();
    badge.textContent = `Logged in as ${data.user.name} (${data.user.role})`;
  } catch {
    localStorage.removeItem("mindbridge_token");
    localStorage.removeItem("mindbridge_user");
    badge.textContent = "Session expired. Please login again.";
  }
}

async function checkBackendStatus() {
  const badge = document.getElementById("backend-status-badge");
  if (!badge) return;

  try {
    const response = await apiFetch("/health");
    if (!response.ok) throw new Error("backend unavailable");
    badge.textContent = "Live Backend Connected";
    badge.classList.add("connected");
    badge.classList.remove("disconnected");
  } catch {
    badge.textContent = "Backend Offline - Retrying";
    badge.classList.add("disconnected");
    badge.classList.remove("connected");
  }
}

async function startChatSession() {
  setStatus("Starting chat session...");
  try {
    const response = await apiFetch("/chat/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await response.json();
    setStatus(data.message || "Chat session started.");
  } catch {
    setStatus("Could not start chat session. Check server connection.", true);
  }
}

async function requestCall() {
  setStatus("Requesting a call back...");
  try {
    const response = await apiFetch("/call/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await response.json();
    setStatus(data.message || "Call request sent.");
  } catch {
    setStatus("Could not request call. Check server connection.", true);
  }
}

async function loadResources() {
  const list = document.getElementById("resources-list");
  if (!list) return;

  list.innerHTML = "Loading resources...";
  try {
    const response = await apiFetch("/resources");
    const data = await response.json();
    const resources = data.resources || [];

    if (!resources.length) {
      list.textContent = "No resources found right now.";
      return;
    }

    list.innerHTML = `<ul>${resources
      .map((resource) => `<li><a href="${resource.url}" target="_blank" rel="noopener noreferrer nofollow">${resource.title}</a> <span class="muted">(External Official Resource)</span></li>`)
      .join("")}</ul><p class="muted">External links open third-party websites that are not owned by MindBridge.</p>`;
  } catch {
    list.textContent = "Could not load resources. Check server connection.";
  }
}

function initMoodTracker() {
  const status = document.getElementById("mood-status");
  const moodButtons = document.querySelectorAll(".mood-btn");
  if (!status || moodButtons.length === 0) return;

  const savedMood = localStorage.getItem("mindbridge_mood");
  if (savedMood) status.textContent = `Last mood: ${savedMood}`;

  moodButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const mood = button.dataset.mood;
      localStorage.setItem("mindbridge_mood", mood);
      status.textContent = `Last mood: ${mood}`;

      try {
        await apiFetch("/mood", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mood })
        });
      } catch {
        // Mood remains locally tracked.
      }
    });
  });
}

function initBreathingCoach() {
  const button = document.getElementById("breathing-btn");
  const status = document.getElementById("breathing-status");
  if (!button || !status) return;

  let timer;
  button.addEventListener("click", () => {
    if (timer) clearInterval(timer);

    const pattern = ["Inhale", "Hold", "Exhale", "Hold"];
    let step = 0;
    let remaining = 8;
    status.textContent = `${pattern[step]} - ${remaining}s`;

    timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        step += 1;
        if (step >= pattern.length) {
          clearInterval(timer);
          status.textContent = "Great job. You completed a calming cycle.";
          return;
        }
        remaining = 8;
      }
      status.textContent = `${pattern[step]} - ${remaining}s`;
    }, 1000);
  });
}

function initActions() {
  const chatBtn = document.getElementById("start-chat-btn");
  const callBtn = document.getElementById("request-call-btn");
  const resourcesBtn = document.getElementById("load-resources-btn");

  if (chatBtn) chatBtn.addEventListener("click", startChatSession);
  if (callBtn) callBtn.addEventListener("click", requestCall);
  if (resourcesBtn) resourcesBtn.addEventListener("click", loadResources);
}

document.addEventListener("DOMContentLoaded", () => {
  initActions();
  initMoodTracker();
  initBreathingCoach();
  loadAuthBadge();
  checkBackendStatus();
});
