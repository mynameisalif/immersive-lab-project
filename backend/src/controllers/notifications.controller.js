// ================================================================
// notifications.controller.js - Notifications API
// ================================================================
// Simple controller untuk get, mark as read, delete notifications

const pool = require("../config/db");

/**
 * GET /api/notifications
 * Get all unread notifications for current user
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id; // From auth middleware

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { rows } = await pool.query(
      `SELECT id, user_id, type, title, message, link, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    res.json({ data: rows });
  } catch (err) {
    console.error("[ERROR] getNotifications:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { rowCount } = await pool.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error("[ERROR] markAsRead:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { rowCount } = await pool.query(
      `DELETE FROM notifications 
       WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("[ERROR] deleteNotification:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/notifications/count/unread
 * Get unread notification count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*) as unread_count
       FROM notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId],
    );

    const unreadCount = parseInt(rows[0]?.unread_count || 0);
    res.json({ data: { unread_count: unreadCount } });
  } catch (err) {
    console.error("[ERROR] getUnreadCount:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
