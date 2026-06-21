const express = require("express");
const router = express.Router();
const approvals = require("../controllers/approvals.controller");
const authenticate = require("../middleware/auth");
const requireRole = require("../middleware/role");

// Admin & Kaprodi (dosen dengan is_kaprodi=true) bisa akses
const dosenOrAdmin = [authenticate, requireRole("dosen", "admin")];

router.get("/pending", ...dosenOrAdmin, approvals.getPending);
router.post("/:id/approve", ...dosenOrAdmin, approvals.approve);
router.post("/:id/reject", ...dosenOrAdmin, approvals.reject);

module.exports = router;
