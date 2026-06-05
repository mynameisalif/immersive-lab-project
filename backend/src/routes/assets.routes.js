const express = require("express");
const router = express.Router();
const assetsController = require("../controllers/assets.controller");

// GET /api/assets — ambil semua aset
router.get("/", (req, res) => {
  assetsController.getAllAssets(req, res);
});

// GET /api/assets/available — aset yang tersedia untuk dipinjam
// ⚠️ HARUS SEBELUM /:id agar tidak tertangkap sebagai ID!
router.get("/available", (req, res) => {
  assetsController.getAvailableAssets(req, res);
});

// GET /api/assets/stats — stats aset
router.get("/stats", (req, res) => {
  assetsController.getAssetStats(req, res);
});

// POST /api/assets — create aset
router.post("/", (req, res) => {
  assetsController.createAsset(req, res);
});

// PATCH /api/assets/units/:unitId — update unit
// ⚠️ HARUS SEBELUM /:id
router.patch("/units/:unitId", (req, res) => {
  assetsController.updateUnit(req, res);
});

// DELETE /api/assets/units/:unitId — delete unit
// ⚠️ HARUS SEBELUM /:id
router.delete("/units/:unitId", (req, res) => {
  assetsController.deleteUnit(req, res);
});

// PATCH /api/assets/:id — update aset
router.patch("/:id", (req, res) => {
  assetsController.updateAsset(req, res);
});

// DELETE /api/assets/:id — delete aset
router.delete("/:id", (req, res) => {
  assetsController.deleteAsset(req, res);
});

module.exports = router;
