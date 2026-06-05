const express = require("express");
const router = express.Router();
const approvals = require("../controllers/approvals.controller");
const authenticate = require("../middleware/auth");
const requireRole = require("../middleware/role");

const dosenOrAdmin = [authenticate, requireRole("dosen", "admin")];

router.get("/pending", ...dosenOrAdmin, approvals.getPendingApprovals);
router.post("/:id/approve", ...dosenOrAdmin, approvals.approveLoan);
router.post("/:id/reject", ...dosenOrAdmin, approvals.rejectLoan);
router.get("/:id/history", authenticate, approvals.getApprovalHistory);

module.exports = router;
