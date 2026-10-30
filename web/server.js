// Sample web service: a visit counter in Redis, a job queue in Postgres, and the
// worker's health over private networking.
const http = require("node:http");
const { createClient } = require("redis");
const { pool } = require("./db");

const port = Number(process.env.PORT || 3000);
const db = pool();
const redis = createClient({ url: process.env.REDIS_URL });
redis.on("error", (err) => console.error("redis:", err.message));

async function workerStatus() {
  if (!process.env.WORKER_URL) return "WORKER_URL isn't set";
  try {
    const res = await fetch(`${process.env.WORKER_URL}/healthz`, { signal: AbortSignal.timeout(2000) });
    return res.ok ? `healthy (${(await res.text()).trim()})` : `unhealthy (HTTP ${res.status})`;
  } catch (err) {
    return `unreachable (${err.message})`;
  }
}

function escape(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

async function page() {
  const visits = await redis.incr("visits");
  const { rows } = await db.query("SELECT id, payload, status, created_at FROM jobs ORDER BY id DESC LIMIT 20");
  const worker = await workerStatus();
  const items = rows
    .map((j) => `<tr><td>${j.id}</td><td>${escape(j.payload)}</td><td>${j.status}</td><td>${j.created_at.toISOString()}</td></tr>`)
    .join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>stackdeploy sample</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px}td,th{padding:4px 8px;text-align:left}</style>
</head><body>
<h1>stackdeploy sample app</h1>
<p>Visits: <strong>${visits}</strong> (Redis)</p>
<p>Worker: <strong>${escape(worker)}</strong></p>
<form method="post" action="/jobs"><button>Enqueue job</button></form>
<h2>Jobs (Postgres)</h2>
<table><tr><th>ID</th><th>Payload</th><th>Status</th><th>Created</th></tr>${items || '<tr><td colspan="4">No jobs yet</td></tr>'}</table>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/healthz") {
      res.writeHead(200).end("ok");
    } else if (req.method === "POST" && req.url === "/jobs") {
      await db.query("INSERT INTO jobs (payload) VALUES ($1)", [`job from ${new Date().toISOString()}`]);
      res.writeHead(303, { Location: "/" }).end();
    } else if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(await page());
    } else {
      res.writeHead(404).end("not found");
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "text/plain" }).end(`error: ${err.message}`);
  }
});

redis.connect().then(() => {
  server.listen(port, () => console.log(`listening on ${port}`));
});
