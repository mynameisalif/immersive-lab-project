const cron = require("node-cron");
const pool = require("../config/db");

// ─── Setiap 30 menit: auto-lock akun gagal login ≥5x ─────────
cron.schedule("*/30 * * * *", async () => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email FROM auto_lock_candidates`,
    );
    if (rows.length === 0) return;

    for (const user of rows) {
      await pool.query(
        `UPDATE profiles SET
           is_blocked     = TRUE,
           auto_locked    = TRUE,
           blocked_reason = 'Terlalu banyak percobaan login gagal',
           blocked_at     = NOW(),
           updated_at     = NOW()
         WHERE id = $1 AND is_blocked = FALSE`,
        [user.id],
      );
      await pool.query(
        `INSERT INTO account_lock_log
           (user_id, action, trigger_type, reason)
         VALUES ($1,'lock','failed_login','Auto-lock: 5+ gagal login')`,
        [user.id],
      );
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1,'account_locked',
           'Akun Anda Dikunci Otomatis',
           'Akun Anda dikunci karena terlalu banyak percobaan login gagal. Hubungi admin.')`,
        [user.id],
      );
    }
    console.log(`[CRON] Auto-lock: ${rows.length} akun dikunci`);
  } catch (err) {
    console.error("[CRON] Auto-lock error:", err.message);
  }
});

// ─── Setiap jam: tandai peminjaman yang melewati deadline ─────
cron.schedule("0 * * * *", async () => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE loan_requests SET status='overdue', updated_at=NOW()
       WHERE status = 'picked_up'
         AND return_deadline < CURRENT_DATE`,
    );
    if (rowCount > 0)
      console.log(`[CRON] Overdue: ${rowCount} peminjaman ditandai overdue`);
  } catch (err) {
    console.error("[CRON] Overdue error:", err.message);
  }
});

// ─── Setiap hari jam 08:00: kirim reminder H-1 sebelum deadline ─
cron.schedule("0 8 * * *", async () => {
  try {
    const { rows } = await pool.query(
      `SELECT lr.id, lr.requester_id, a.name AS asset_name, lr.return_deadline
       FROM loan_requests lr
       JOIN assets a ON a.id = lr.asset_id
       WHERE lr.status = 'picked_up'
         AND lr.return_deadline = CURRENT_DATE + INTERVAL '1 day'
         AND lr.reminder_sent = FALSE`,
    );

    for (const loan of rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1,'loan_reminder',
           'Pengingat Pengembalian Aset',
           $2, $3)`,
        [
          loan.requester_id,
          `Aset "${loan.asset_name}" harus dikembalikan besok (${loan.return_deadline}).`,
          `/loans/${loan.id}`,
        ],
      );
      await pool.query(
        `UPDATE loan_requests SET
           reminder_sent=TRUE, warning_count=warning_count+1,
           last_warning_at=NOW()
         WHERE id=$1`,
        [loan.id],
      );
    }
    if (rows.length > 0)
      console.log(`[CRON] Reminder: ${rows.length} notifikasi H-1 dikirim`);
  } catch (err) {
    console.error("[CRON] Reminder error:", err.message);
  }
});

// ─── Setiap malam jam 00:05: auto-unlock akun jika unlock_at sudah lewat ─
cron.schedule("5 0 * * *", async () => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name FROM profiles
       WHERE is_blocked = TRUE
         AND unlock_at IS NOT NULL
         AND unlock_at <= NOW()`,
    );

    for (const user of rows) {
      await pool.query(
        `UPDATE profiles SET
           is_blocked=FALSE, auto_locked=FALSE,
           blocked_reason=NULL, blocked_at=NULL, unlock_at=NULL,
           updated_at=NOW()
         WHERE id=$1`,
        [user.id],
      );
      await pool.query(
        `INSERT INTO account_lock_log
           (user_id, action, trigger_type, reason)
         VALUES ($1,'unlock','admin_manual','Auto-unlock terjadwal')`,
        [user.id],
      );
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1,'account_unlocked',
           'Akun Anda Telah Dibuka',
           'Akun Anda telah dibuka secara otomatis sesuai jadwal.')`,
        [user.id],
      );
    }
    if (rows.length > 0)
      console.log(`[CRON] Auto-unlock: ${rows.length} akun dibuka`);
  } catch (err) {
    console.error("[CRON] Auto-unlock error:", err.message);
  }
});

console.log("[CRON] Semua cron job aktif");
