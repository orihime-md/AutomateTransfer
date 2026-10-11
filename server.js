const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Sandbox safety: this app now controls REAL attacks.
// Limit total concurrent jobs to avoid DoS.
const LIMIT_OF_ACCOUNT = Math.max(1, Number.parseInt(process.env.LIMIT_OF_ACCOUNT || "200000", 10) || 200000);
const MAX_CONCURRENT_JOBS = 3;
const jobs = new Map();
let activeJobCount = 0;

// Allow the GitHub Pages frontend to call this API.
const allowedOrigins = new Set([
  "https://orihime-md.github.io",
  ...(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ 
    ok: true, 
    service: "lagoslife-transfer-engine", 
    mode: "live-operation", 
    activeJobs: activeJobCount,
    maxJobs: MAX_CONCURRENT_JOBS,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/config", (_req, res) => {
  res.json({ 
    limitOfAccount: LIMIT_OF_ACCOUNT, 
    mode: "live-operation",
    warning: "This is NOT a sandbox. Real accounts are created and gifts sent."
  });
});

app.post("/api/jobs", (req, res) => {
  const username = String(req.body?.targetUsername || "").trim();
  const count = Number(req.body?.accountCount);

  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    return res.status(400).json({ error: "Enter a username with 2–32 letters, numbers, dots, underscores, or hyphens." });
  }
  if (!Number.isInteger(count) || count < 1) {
    return res.status(400).json({ error: "Account count must be a whole number of at least 1." });
  }
  if (count > LIMIT_OF_ACCOUNT) {
    return res.status(400).json({ error: `The maximum allowed count is ${LIMIT_OF_ACCOUNT}.` });
  }

  if (activeJobCount >= MAX_CONCURRENT_JOBS) {
    return res.status(429).json({ error: `Too many jobs running. Max ${MAX_CONCURRENT_JOBS} concurrent.` });
  }

  const id = crypto.randomUUID();
  const job = {
    id,
    targetUsername: username,
    requested: count,
    completed: 0,
    status: "running",
    createdAt: new Date().toISOString(),
    events: []
  };
  jobs.set(id, job);
  activeJobCount++;

  addEvent(job, `🔥 LIVE ATTACK INITIATED: ${count} accounts to gift @${username}`);
  addEvent(job, `⚡ Real automation via bot.js — NOT a simulation`);

  res.status(201).json({ id, status: job.status, requested: count });

  // LAUNCH REAL BOT.JS
  const botProcess = spawn("node", ["bot.js"], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      TARGET_USERNAME: username,
      ACCOUNT_COUNT: count.toString(),
      JOB_ID: id,
      NODE_ENV: 'production'
    }
  });

  // Capture bot.js stdout (its console.log)
  let botOutput = '';
  botProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    botOutput += chunk;
    // Forward to job log
    chunk.split('\n').filter(line => line.trim()).forEach(line => {
      addEvent(job, `[BOT] ${line.trim()}`);
    });
  });

  botProcess.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line) addEvent(job, `[ERR] ${line}`);
  });

  botProcess.on('close', (code) => {
    if (code === 0) {
      job.status = "completed";
      addEvent(job, "✅ Attack completed successfully.");
    } else {
      job.status = "failed";
      addEvent(job, `💥 Attack failed with exit code ${code}.`);
    }
    activeJobCount = Math.max(0, activeJobCount - 1);
    // Save final results if bot generated any
    if (fs.existsSync("automation_test_results.json")) {
      try {
        const results = JSON.parse(fs.readFileSync("automation_test_results.json", "utf8"));
        job.resultCount = results.length;
        job.giftsSent = results.filter(r => r.gift_response).length;
      } catch {}
    }
  });

  botProcess.on('error', (err) => {
    job.status = "failed";
    addEvent(job, `🚨 Process error: ${err.message}`);
    activeJobCount = Math.max(0, activeJobCount - 1);
  });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json(job);
});

// Return a clear JSON error for mistyped or missing API endpoints.
app.use("/api", (req, res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.path}`,
    hint: "Deploy the current server.js and request /api/config exactly, without extra characters."
  });
});

function addEvent(job, message) {
  job.events.push({ at: new Date().toISOString(), message });
}

app.listen(PORT, () => {
  console.log(`🔥 LIVE OPERATION MODE ACTIVE on port ${PORT}`);
  console.log(`Maximum real accounts per job: ${LIMIT_OF_ACCOUNT}`);
  console.log(`Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);
  console.log("API routes: GET /health, GET /api/config, POST /api/jobs, GET /api/jobs/:id");
  console.log(`Allowed frontend origins: ${[...allowedOrigins].join(", ") || "none configured"}`);
  console.log("⚠️  WARNING: This is NOT a sandbox. bot.js will create REAL accounts and send REAL gifts.");
});