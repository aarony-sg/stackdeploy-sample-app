// DATABASE_URL comes from ${{postgres.DATABASE_URL}}. RDS requires TLS, but Node doesn't
// trust the RDS certificate authority, so encrypt without verifying (fine for a demo).
const { Pool } = require("pg");

function pool() {
  const url = new URL(process.env.DATABASE_URL);
  const ssl = url.searchParams.has("sslmode") ? { rejectUnauthorized: false } : false;
  url.searchParams.delete("sslmode");
  return new Pool({ connectionString: url.toString(), ssl, max: 5 });
}

module.exports = { pool };
