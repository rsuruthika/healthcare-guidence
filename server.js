const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 8);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const dbFiles = {
  resources: path.join(__dirname, "resources.json"),
  chat: path.join(__dirname, "chatHistory.json"),
  feedback: path.join(__dirname, "feedback.json"),
  analytics: path.join(__dirname, "analytics.json"),
  moods: path.join(__dirname, "moods.json")
};

const users = [
  { id: "stu-1", username: "student", password: "student123", role: "student", name: "Student User" },
  { id: "csl-1", username: "counselor", password: "counselor123", role: "counselor", name: "Counselor User" },
  { id: "adm-1", username: "admin", password: "admin123", role: "admin", name: "Admin User" }
];

const sessions = new Map();

function readJson(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, "utf8");
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function incrementAnalytics(eventName) {
  const analytics = readJson(dbFiles.analytics, {});
  analytics[eventName] = (analytics[eventName] || 0) + 1;
  writeJson(dbFiles.analytics, analytics);
}

function createSession(user) {
  const token = `mb_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  sessions.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function getSessionToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.replace("Bearer ", "").trim();
  return req.headers["x-session-token"];
}

function authRequired(req, res, next) {
  const token = getSessionToken(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const session = sessions.get(token);
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ success: false, message: "Session expired" });
  }

  req.session = session;
  req.sessionToken = token;
  next();
}

function roleRequired(allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !allowedRoles.includes(req.session.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "MindBridge API", env: process.env.NODE_ENV || "development" });
});

app.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find((candidate) => candidate.username === username && candidate.password === password);

  if (!user) {
    incrementAnalytics("loginFailed");
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const token = createSession(user);
  incrementAnalytics("loginSuccess");

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

app.get("/auth/me", authRequired, (req, res) => {
  res.json({ success: true, user: req.session });
});

app.post("/auth/logout", authRequired, (req, res) => {
  sessions.delete(req.sessionToken);
  res.json({ success: true, message: "Logged out" });
});

app.post("/chat/start", (req, res) => {
  const chatHistory = readJson(dbFiles.chat, []);
  chatHistory.push({
    type: "session_start",
    time: Date.now(),
    source: "homepage"
  });
  writeJson(dbFiles.chat, chatHistory);
  incrementAnalytics("chatStarted");
  res.json({ success: true, message: "Chat session started. A counselor will join soon." });
});

app.post("/call/request", (req, res) => {
  incrementAnalytics("callRequests");
  res.json({ success: true, message: "Call request received. A counselor will call you shortly." });
});

app.get("/resources", (req, res) => {
  const resources = readJson(dbFiles.resources, []);
  res.json({ resources });
});

app.post("/chat/send", (req, res) => {
  const { user, message } = req.body;
  if (!user || !message) {
    return res.status(400).json({ success: false, message: "user and message are required" });
  }

  const chatHistory = readJson(dbFiles.chat, []);
  chatHistory.push({ user, message, time: Date.now() });
  writeJson(dbFiles.chat, chatHistory);
  incrementAnalytics("chatMessages");

  res.json({ success: true });
});

app.get("/chat/history", (req, res) => {
  const history = readJson(dbFiles.chat, []);
  res.json({ history });
});

app.post("/feedback", (req, res) => {
  const { feedback, source = "unknown" } = req.body;
  if (!feedback) {
    return res.status(400).json({ success: false, message: "feedback is required" });
  }

  const allFeedback = readJson(dbFiles.feedback, []);
  allFeedback.push({ feedback, source, time: Date.now() });
  writeJson(dbFiles.feedback, allFeedback);
  incrementAnalytics("feedbackSubmitted");
  res.json({ success: true });
});

app.post("/analytics", (req, res) => {
  const { event } = req.body;
  if (!event) return res.status(400).json({ success: false, message: "event is required" });

  incrementAnalytics(event);
  res.json({ success: true });
});

app.get("/analytics", (req, res) => {
  const analytics = readJson(dbFiles.analytics, {});
  res.json({ analytics });
});

app.get("/admin/analytics", authRequired, roleRequired(["admin"]), (req, res) => {
  const analytics = readJson(dbFiles.analytics, {});
  const feedback = readJson(dbFiles.feedback, []);
  const moods = readJson(dbFiles.moods, []);
  const chats = readJson(dbFiles.chat, []);

  res.json({
    success: true,
    analytics,
    overview: {
      totalFeedback: feedback.length,
      totalMoodLogs: moods.length,
      totalChatEvents: chats.length,
      activeSessions: sessions.size
    },
    latestFeedback: feedback.slice(-5).reverse(),
    latestMoods: moods.slice(-10).reverse()
  });
});

app.post("/mood", (req, res) => {
  const { mood } = req.body;
  if (!mood) return res.status(400).json({ success: false, message: "mood is required" });

  const moods = readJson(dbFiles.moods, []);
  moods.push({ mood, time: Date.now() });
  writeJson(dbFiles.moods, moods);
  incrementAnalytics("moodLogged");

  res.json({ success: true });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});

app.listen(PORT, () => {
  console.log(`MindBridge backend running on http://localhost:${PORT}`);
});
