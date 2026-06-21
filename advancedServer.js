const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;

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

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "MindBridge Advanced API" });
});

app.post("/chat/start", (req, res) => {
  const chatHistory = readJson(dbFiles.chat, []);
  chatHistory.push({ type: "session_start", time: Date.now(), source: "advanced" });
  writeJson(dbFiles.chat, chatHistory);
  res.json({ success: true, message: "Chat session started." });
});

app.post("/chat/send", (req, res) => {
  const { user, message } = req.body;
  if (!user || !message) {
    return res.status(400).json({ success: false, message: "user and message are required" });
  }

  const chatHistory = readJson(dbFiles.chat, []);
  chatHistory.push({ user, message, time: Date.now() });
  writeJson(dbFiles.chat, chatHistory);
  res.json({ success: true });
});

app.get("/chat/history", (req, res) => {
  res.json({ history: readJson(dbFiles.chat, []) });
});

app.post("/call/request", (req, res) => {
  const analytics = readJson(dbFiles.analytics, {});
  analytics.callRequests = (analytics.callRequests || 0) + 1;
  writeJson(dbFiles.analytics, analytics);
  res.json({ success: true, message: "Call request received." });
});

app.get("/resources", (req, res) => {
  res.json({ resources: readJson(dbFiles.resources, []) });
});

app.post("/feedback", (req, res) => {
  const { feedback, source = "unknown" } = req.body;
  if (!feedback) {
    return res.status(400).json({ success: false, message: "feedback is required" });
  }

  const allFeedback = readJson(dbFiles.feedback, []);
  allFeedback.push({ feedback, source, time: Date.now() });
  writeJson(dbFiles.feedback, allFeedback);
  res.json({ success: true });
});

app.post("/analytics", (req, res) => {
  const { event } = req.body;
  if (!event) {
    return res.status(400).json({ success: false, message: "event is required" });
  }

  const analytics = readJson(dbFiles.analytics, {});
  analytics[event] = (analytics[event] || 0) + 1;
  writeJson(dbFiles.analytics, analytics);
  res.json({ success: true });
});

app.get("/analytics", (req, res) => {
  res.json({ analytics: readJson(dbFiles.analytics, {}) });
});

app.post("/mood", (req, res) => {
  const { mood } = req.body;
  if (!mood) {
    return res.status(400).json({ success: false, message: "mood is required" });
  }

  const moods = readJson(dbFiles.moods, []);
  moods.push({ mood, time: Date.now() });
  writeJson(dbFiles.moods, moods);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`MindBridge advanced backend running on http://localhost:${PORT}`);
});
