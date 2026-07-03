const pool = require("../config/db");

// Helper notifikasi
async function sendNotif(client, userId, type, title, message) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, message)
     VALUES ($1,$2,$3,$4)`,
    [userId, type, title, message],
  );
}

// ─── GET semua user (admin) ───────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.email, p.full_name, p.nim_nip, p.phone,
              p.is_kaprodi,
              p.is_blocked, p.blocked_reason, p.blocked_at,
              p.auto_locked, p.created_at,
              ur.role
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       ORDER BY p.created_at DESC`,
    );
    res.json({ data: rows });
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── GET detail satu user ─────────────────────────────────────
exports.getUserById = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.email, p.full_name, p.nim_nip, p.phone,
              p.is_kaprodi,
              p.is_blocked, p.blocked_reason, p.blocked_at,
              p.auto_locked, p.unlock_at, p.created_at,
              ur.role
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       WHERE p.id = $1`,
      [req.params.id],
    );
    if (!rows[0])
      return res.status(404).json({ message: "User tidak ditemukan" });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error("getUserById error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── PATCH lock akun manual (admin) ──────────────────────────
exports.blockUser = async (req, res) => {
  const { reason, unlock_at } = req.body;
  if (!reason)
    return res.status(400).json({ message: "Alasan penguncian wajib diisi" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userRes = await client.query(
      "SELECT id, is_blocked, full_name FROM profiles WHERE id = $1",
      [req.params.id],
    );
    if (!userRes.rows[0])
      return res.status(404).json({ message: "User tidak ditemukan" });

    if (userRes.rows[0].is_blocked)
      return res
        .status(400)
        .json({ message: "Akun sudah dalam status terkunci" });

    if (req.params.id === req.user.userId)
      return res
        .status(400)
        .json({ message: "Tidak dapat mengunci akun sendiri" });

    await client.query(
      `UPDATE profiles SET
         is_blocked     = TRUE,
         auto_locked    = FALSE,
         blocked_reason = $1,
         blocked_at     = NOW(),
         unlock_at      = $2,
         updated_at     = NOW()
       WHERE id = $3`,
      [reason, unlock_at || null, req.params.id],
    );

    await client.query(
      `INSERT INTO account_lock_log (user_id, action, trigger_type, reason, locked_by)
       VALUES ($1, 'lock', 'admin_manual', $2, $3)`,
      [req.params.id, reason, req.user.userId],
    );

    await sendNotif(
      client,
      req.params.id,
      "account_locked",
      "Akun Anda Dikunci",
      `Akun Anda telah dikunci oleh admin. Alasan: ${reason}`,
    );

    await client.query("COMMIT");
    res.json({ message: `Akun ${userRes.rows[0].full_name} berhasil dikunci` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("blockUser error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    client.release();
  }
};

// ─── PATCH unlock akun (admin) ────────────────────────────────
exports.unblockUser = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userRes = await client.query(
      "SELECT id, is_blocked, full_name FROM profiles WHERE id = $1",
      [req.params.id],
    );
    if (!userRes.rows[0])
      return res.status(404).json({ message: "User tidak ditemukan" });

    if (!userRes.rows[0].is_blocked)
      return res
        .status(400)
        .json({ message: "Akun tidak dalam status terkunci" });

    await client.query(
      `UPDATE profiles SET
         is_blocked     = FALSE,
         auto_locked    = FALSE,
         blocked_reason = NULL,
         blocked_at     = NULL,
         unlock_at      = NULL,
         updated_at     = NOW()
       WHERE id = $1`,
      [req.params.id],
    );

    await client.query(
      `INSERT INTO account_lock_log (user_id, action, trigger_type, reason, unlocked_by)
       VALUES ($1, 'unlock', 'admin_manual', 'Dibuka manual oleh admin', $2)`,
      [req.params.id, req.user.userId],
    );

    await sendNotif(
      client,
      req.params.id,
      "account_unlocked",
      "Akun Anda Telah Dibuka",
      "Akun Anda telah dibuka kembali oleh admin. Anda dapat login kembali.",
    );

    await client.query("COMMIT");
    res.json({ message: `Akun ${userRes.rows[0].full_name} berhasil dibuka` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("unblockUser error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    client.release();
  }
};

// ─── PATCH block/unblock (shorthand) ─────────────────────────
exports.blockUnblockUser = async (req, res) => {
  const { id } = req.params;
  const { is_blocked, reason } = req.body;

  try {
    const { rowCount } = await pool.query(
      `UPDATE profiles 
       SET is_blocked = $1, blocked_reason = $2, blocked_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [is_blocked, reason || null, id],
    );

    if (rowCount === 0)
      return res.status(404).json({ message: "User tidak ditemukan" });

    res.json({
      message: is_blocked
        ? "Akun berhasil dikunci"
        : "Akun berhasil diaktifkan",
    });
  } catch (err) {
    console.error("blockUnblockUser error:", err);
    res.status(500).json({ message: "Gagal mengubah status akun" });
  }
};

// ─── GET kandidat auto-lock ───────────────────────────────────
exports.getLockCandidates = async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM auto_lock_candidates`);
    res.json({ data: rows });
  } catch (err) {
    console.error("getLockCandidates error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── GET log lock/unlock ──────────────────────────────────────
exports.getLockLog = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT alog.*, p.full_name AS user_name,
              lb.full_name AS locked_by_name,
              ub.full_name AS unlocked_by_name
       FROM account_lock_log alog
       JOIN profiles p ON p.id = alog.user_id
       LEFT JOIN profiles lb ON lb.id = alog.locked_by
       LEFT JOIN profiles ub ON ub.id = alog.unlocked_by
       ORDER BY alog.created_at DESC
       LIMIT 100`,
    );
    res.json({ data: rows });
  } catch (err) {
    console.error("getLockLog error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── GET daftar dosen ─────────────────────────────────────────
exports.getDosen = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.full_name, p.email, p.nim_nip
       FROM profiles p
       JOIN user_roles ur ON ur.user_id = p.id
       WHERE ur.role = 'dosen' AND p.is_blocked = FALSE
       ORDER BY p.full_name`,
    );
    res.json({ data: rows });
  } catch (err) {
    console.error("getDosen error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── GET notifikasi ───────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  const userId = req.user?.userId; // ✅ sesuai JWT payload
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  try {
    if (!userId) {
      return res.json({
        data: [],
        pagination: { total: 0, page: 1, limit, totalPages: 0 },
      });
    }

    // ✅ Count total notifikasi milik user ini
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1`,
      [userId],
    );
    const total = parseInt(countRes.rows[0].count) || 0;

    // ✅ Data dengan LIMIT/OFFSET
    const { rows } = await pool.query(
      `SELECT id, user_id, type, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    res.json({
      data: rows || [],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getNotifications error:", err);
    res.json({
      data: [],
      pagination: { total: 0, page: 1, limit, totalPages: 0 },
    });
  }
};
// ─── PATCH tandai notifikasi dibaca ──────────────────────────
exports.markNotifRead = async (req, res) => {
  const userId = req.user?.userId; // ✅ userId
  const notifId = req.params.notifId || req.params.id;

  try {
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { rowCount } = await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE id = $1 AND user_id = $2`,
      [notifId, userId],
    );

    if (rowCount === 0)
      return res.status(404).json({ message: "Notifikasi tidak ditemukan" });

    res.json({ message: "Notifikasi ditandai sudah dibaca" });
  } catch (err) {
    console.error("markNotifRead error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── PATCH tandai semua notifikasi dibaca ────────────────────
exports.markAllNotificationsRead = async (req, res) => {
  const userId = req.user?.userId; // ✅ userId
  try {
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { rows } = await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE
       RETURNING id`,
      [userId],
    );

    res.json({
      message: "Semua notifikasi ditandai sudah dibaca",
      count: rows.length,
    });
  } catch (err) {
    console.error("markAllNotificationsRead error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── PATCH update NIM/NIP ─────────────────────────────────────
exports.updateNimNip = async (req, res) => {
  const { nim_nip } = req.body;
  if (!nim_nip)
    return res.status(400).json({ message: "NIM/NIP tidak boleh kosong" });

  try {
    const { rows } = await pool.query(
      `UPDATE profiles SET nim_nip = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, full_name, email, nim_nip`,
      [nim_nip, req.params.id],
    );
    if (!rows[0])
      return res.status(404).json({ message: "User tidak ditemukan" });

    res.json({ message: "NIM/NIP berhasil diperbarui", data: rows[0] });
  } catch (err) {
    console.error("updateNimNip error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── PATCH update profile ─────────────────────────────────────
exports.updateUserProfile = async (req, res) => {
  const { id } = req.params;
  const { nim_nip } = req.body;

  try {
    const { rowCount } = await pool.query(
      `UPDATE profiles SET nim_nip = COALESCE($1, nim_nip), updated_at = NOW()
       WHERE id = $2`,
      [nim_nip || null, id],
    );

    if (rowCount === 0)
      return res.status(404).json({ message: "User tidak ditemukan" });

    res.json({ message: "Profil berhasil diperbarui" });
  } catch (err) {
    console.error("updateUserProfile error:", err);
    res.status(500).json({ message: "Gagal memperbarui profil" });
  }
};

// ─── GET stats user ───────────────────────────────────────────
exports.getUserStats = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM profiles WHERE is_blocked = TRUE`,
    );
    res.json({ data: { blocked: parseInt(rows[0].count, 10) } });
  } catch (err) {
    console.error("getUserStats error:", err);
    res.status(500).json({ message: "Gagal fetch stats user" });
  }
};
