const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "lab_immersive",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "PlayerNoob69#",
});

pool.on("connect", () => console.log("[DB] Terhubung ke PostgreSQL"));
pool.on("error", (err) => console.error("[DB] Error:", err.message));

module.exports = pool;
