// Pre-deploy command: creates the jobs table before the new version takes traffic.
const { pool } = require("./db");

async function main() {
  const db = pool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )`);
  console.log("migrations applied");
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
