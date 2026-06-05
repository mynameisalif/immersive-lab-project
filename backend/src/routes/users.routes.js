const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users.controller");

// GET /api/users — ambil semua user
router.get("/", (req, res) => {
  usersController.getAllUsers(req, res);
});

// GET /api/users/stats — ambil stats user
router.get("/stats", (req, res) => {
  usersController.getUserStats(req, res);
});

// GET /api/users/dosen — ambil daftar dosen
router.get("/dosen", (req, res) => {
  usersController.getDosen(req, res);
});

// GET /api/users/notifications — ambil notifikasi user
router.get("/notifications", (req, res) => {
  usersController.getNotifications(req, res);
});

// PATCH /api/users/:id/block — kunci/buka akun
router.patch("/:id/block", (req, res) => {
  usersController.blockUnblockUser(req, res);
});

// PATCH /api/users/:id — update profile (NIM/NIP, dll)
router.patch("/:id", (req, res) => {
  usersController.updateUserProfile(req, res);
});

// PATCH /api/users/notifications/mark-all-read — tandai semua notifikasi dibaca
router.patch("/notifications/mark-all-read", (req, res) => {
  usersController.markAllNotificationsRead(req, res);
});

// PATCH /api/users/notifications/:id/read — tandai notifikasi dibaca
router.patch("/notifications/:id/read", (req, res) => {
  usersController.markNotifRead(req, res);
});

module.exports = router;
