// server.js
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

// ------------------------------------------------------
// 🔧 CONFIG — opgehaald uit environment variables (Render)
// ------------------------------------------------------
const {
  PGHOST,
  PGPORT,
  PGDATABASE,
  PGUSER,
  PGPASSWORD,
  RUNNER_TOKEN // shared token dat in de widget wordt meegestuurd
} = process.env;

// ------------------------------------------------------
// 🧩 PostgreSQL connectiepool
// ------------------------------------------------------
const pool = new Pool({
  host: PGHOST,
  port: PGPORT ? Number(PGPORT) : 5432,
  database: PGDATABASE,
  user: PGUSER,
  password: PGPASSWORD,
  ssl: { rejectUnauthorized: false } // vereist bij Render Postgres
});

// ------------------------------------------------------
// ⚙️ Express setup
// ------------------------------------------------------
const app = express();
app.use(cors()); // voor demo: alles toestaan. Later beperken tot je domein.
app.use(express.json());

// ------------------------------------------------------
// 🩺 Health check endpoint
// ------------------------------------------------------
app.get("/", (req, res) => {
  res.json({ ok: true, msg: "SQL runner alive" });
});

// ------------------------------------------------------
// 🚀 Demo SQL Runner Endpoint (mag ook CREATE TABLE uitvoeren)
// ------------------------------------------------------
app.post("/run-sql", async (req, res) => {
  try {
    // Controleer token (lichtgewicht access control)
    if (RUNNER_TOKEN) {
      const clientToken = req.headers["x-runner-token"];
      if (clientToken !== RUNNER_TOKEN) {
        return res.status(403).json({ error: "Forbidden: invalid token" });
      }
    }

    const sql = req.body && req.body.sql;
    if (!sql || typeof sql !== "string" || !sql.trim()) {
      return res.status(400).json({ error: "Missing or invalid 'sql' in request body" });
    }

    // ✳️ Voor demo: sta SELECT en CREATE TABLE (en DROP TABLE) toe
    const up = sql.trim().toUpperCase();
    if (
      !(
        up.startsWith("SELECT") ||
        up.startsWith("CREATE TABLE") ||
        up.startsWith("DROP TABLE")
      )
    ) {
      return res.status(400).json({
        error: "Only SELECT, CREATE TABLE, and DROP TABLE statements are allowed in demo mode."
      });
    }

    // 🧠 Query uitvoeren
    const result = await pool.query(sql);

    // Bouw een slim antwoord
    res.json({
      ok: true,
      command: result.command || null,
      rowCount: typeof result.rowCount === "number" ? result.rowCount : null,
      rows: result.rows || []
    });
  } catch (err) {
    console.error("❌ Query failed:", err);
    res.status(500).json({ error: err.message || "Query failed" });
  }
});

// ------------------------------------------------------
// 🚦 Start server
// ------------------------------------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SQL runner listening on port ${PORT}`);
});
