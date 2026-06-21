const express = require("express");
const router = express.Router();
const notificationsController = require("../controllers/notifications.controller");
const authenticateToken = require("../middleware/auth"); // ✅ CORRECT: Default import (no destructuring)

/**
 * GET /api/notifications
 * Get all notifications for current user
 */
router.get("/", authenticateToken, notificationsController.getNotifications);

/**
 * GET /api/notifications/count/unread
 * Get unread notification count
 */
router.get(
  "/count/unread",
  authenticateToken,
  notificationsController.getUnreadCount,
);

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch(
  "/:id/read",
  authenticateToken,
  notificationsController.markAsRead,
);

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
router.delete(
  "/:id",
  authenticateToken,
  notificationsController.deleteNotification,
);

module.exports = router;
