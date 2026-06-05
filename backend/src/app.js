const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const assetRoutes = require("./routes/assets.routes");
const loanRoutes = require("./routes/loans.routes");
const approvalRoutes = require("./routes/approvals.routes");
const userRoutes = require("./routes/users.routes");

require("./jobs/cron");

const app = express();

// ── CORS ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ── Helmet ────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  }),
);

// ── Body parser ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ──────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/users", userRoutes);

// ── Health check ──────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res
    .status(404)
    .json({ message: `Route ${req.method} ${req.path} tidak ditemukan` });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.stack);
  if (err.message && err.message.includes("diizinkan"))
    return res.status(400).json({ message: err.message });
  res
    .status(500)
    .json({ message: "Terjadi kesalahan server", detail: err.message });
});

module.exports = app;
