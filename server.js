const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 

000;

// Sandbox safety: this app does not contact any third-party service.
// Reduce this value whenever you want; it is enforced on the server.
const LIMIT_OF_ACCOUNT = Math.max(1, Number.parseInt(process.env.LIMIT_OF_ACCOUNT || "200000", 10) || 200000);
const jobs = new Map();

app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (_req, res) => {
  res.json({ limitOfAccount: LIMIT_OF_ACCOUNT, mode: "sandbox simulation" });
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

  const id = crypto.randomUUID();
  const job = {
    id, targetUsername: username, requested: count, completed: 0,
    status: "running", createdAt: new Date().toISOString(), events: []
  };
  jobs.set(id, job);
  addEvent(job, `Started sandbox simulation for target "${username}".`);
  res.status(201).json({ id, status: job.status, requested: count });

  // Simulate work locally. No external accounts are created and no real gifts are sent.
  (async () => {
    for (let i = 1; i <= count; i++) {
      await new Promise(resolve => setTimeout(resolve, 900));
      const account = `demo_${crypto.randomBytes(3).toString("hex")}`;
      job.completed = i;
      addEvent(job, `Simulated account ${i}/${count}: ${account} created in demo data.`);
      addEvent(job, `Simulated gift delivery from ${account} to ${username} (no real transfer).`);
    }
    job.status = "completed";
    addEvent(job, "Sandbox job completed. No third-party service was contacted.");
  })().catch(err => {
    job.status = "failed";
    addEvent(job, `Simulation error: ${err.message}`);
  });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json(job);
});

function addEvent(job, message) {
  job.events.push({ at: new Date().toISOString(), message });
}

app.listen(PORT, () => {
  console.log(`Sandbox demo running on port ${PORT}`);
  console.log(`Maximum simulated accounts per job: ${LIMIT_OF_ACCOUNT}`);
});
