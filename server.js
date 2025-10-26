// server.js
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

// ---- CONFIG UIT ENV ----
// Deze waardes gaan we via Render env vars instellen.
// Locally kun je een .env bestand gebruiken.
const {
  PGHOST,
  PGPORT,
  PGDATABASE,
  PGUSER,
  PGPASSWORD,
  RUNNER_TOKEN // optioneel simple shared secret
} = process.env;

// Maak een Postgres pool (connection pool)
const pool = new Pool({
  host: PGHOST,
  port: PGPORT ? Number(PGPORT) : 5432,
  database: PGDATABASE,
  user: PGUSER,
  password: PGPASSWORD,
  ssl: { rejectUnauthorized: false } // Render Postgres vaak nodig
});

const app = express();

// We staan CORS toe tijdens prototype.
// Later kun je dit beperken naar alleen jouw domein.
app.use(cors());
app.use(express.json());

// heel simpele guard: alleen SELECT toestaan
function isSafeSelect(sql) {
  if (!sql || typeof sql !== "string") return false;
  const normalized = sql.trim().toUpperCase();

  // 1. moet beginnen met SELECT
  if (!normalized.startsWith("SELECT")) return false;

  // 2. blokkeer obvious DDL/DML keywords als defense in depth
  const forbidden = [" DROP ", " DELETE ", " UPDATE ", " INSERT ", " ALTER ", " CREATE "];
  for (const bad of forbidden) {
    if (normalized.includes(bad)) return false;
  }

  return true;
}

// health check (handig voor Render)
app.get("/", (req, res) => {
  res.json({ ok: true, msg: "SQL runner alive" });
});

// hoofd-endpoint
app.post("/run-sql", async (req, res) => {
  try {
    // shared secret check (lightweight access control)
    if (RUNNER_TOKEN) {
      const clientToken = req.headers["x-runner-token"];
      if (clientToken !== RUNNER_TOKEN) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const sql = req.body && req.body.sql;
    if (!sql) {
      return res.status(400).json({ error: "Missing 'sql' in body" });
    }

    if (!isSafeSelect(sql)) {
      return res.status(400).json({ error: "Only simple read-only SELECT queries are allowed." });
    }

    const result = await pool.query(sql);

    return res.json({
      rows: result.rows || []
    });
  } catch (err) {
    console.error("Query failed:", err);
    return res.status(500).json({ error: err.message || "Query failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("SQL runner listening on port " + PORT);
});
