const express = require("express");
const router = express.Router();
const auth = require("../controllers/auth.controller");
const authenticate = require("../middleware/auth");

router.post("/register", auth.register);
router.post("/login", auth.login);
router.post("/logout", authenticate, auth.logout);
router.get("/me", authenticate, auth.getProfile);

module.exports = router;
