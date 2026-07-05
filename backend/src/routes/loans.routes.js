const express = require("express");
const router = express.Router();
const loans = require("../controllers/loans.controller");
const authenticate = require("../middleware/auth");
const requireRole = require("../middleware/role");
const upload = require("../middleware/upload");

// ✅ Pastikan middleware berbentuk array of functions
// Jika requireRole mengembalikan middleware function:
const adminMiddleware = requireRole("admin");
const admin = [authenticate, adminMiddleware];

// Debug saat startup (hapus setelah confirmed working)
console.log("authenticate type:", typeof authenticate);
console.log("requireRole type:", typeof requireRole);
console.log("requireRole('admin') type:", typeof adminMiddleware);
console.log(
  "admin array:",
  admin.map((f) => typeof f),
);

router.get("/:id/units", authenticate, loans.getLoanUnits);
router.get("/pickup/approved", authenticate, loans.getApprovedForPickup);
router.get("/return/pending", authenticate, loans.getReturnPending);
router.get("/report/all", authenticate, loans.getAllLoansForReport);
router.get("/stats", authenticate, loans.getLoanStats); // ✅ TAMBAH INI
router.get("/recent", authenticate, loans.getRecentLoans);
router.get("/number/next", authenticate, loans.getNextLoanNumber);
router.get("/", authenticate, loans.getAllLoans);



router.get("/:id", authenticate, loans.getLoanById);

router.post("/", authenticate, upload.single("proposal"), loans.createLoan);
router.post(
  "/:id/upload",
  authenticate,
  upload.single("proposal"),
  loans.uploadProposal,
);

router.patch("/:id/pickup", ...admin, loans.confirmPickup);
router.patch("/:id/return", ...admin, loans.confirmReturn);

module.exports = router;
