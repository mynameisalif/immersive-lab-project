// ================================================================
// jobs/cron.js — UPDATED
//
// PERUBAHAN dari versi sebelumnya:
//   🔧 FIX 1: H-1 reminder tidak lagi increment warning_count
//   🔧 FIX 2: Overdue cron sekarang kirim notif W1
//   🔧 FIX 3: Link notif diperbaiki → /pinjaman
//   ➕ BARU:  Warning 2 (H+3 setelah W1)
//   ➕ BARU:  Auto-lock (H+3 setelah W2)
//
// FLOW warning_count:
//   0 = belum ada warning (baru overdue)
//   1 = W1 sudah dikirim
//   2 = W2 sudah dikirim
//   3 = sudah di-lock (stop processing)
// ================================================================

const cron = require("node-cron");
const pool = require("../config/db");

// ─── Setiap 30 menit: auto-lock akun gagal login ≥5x ─────────
// (tidak berubah)
// cron.schedule("*/30 * * * *", async () => {
//   try {
//     const { rows } = await pool.query(
//       `SELECT id, email FROM auto_lock_candidates`,
//     );
//     if (rows.length === 0) return;

//     for (const user of rows) {
//       await pool.query(
//         `UPDATE profiles SET
//            is_blocked     = TRUE,
//            auto_locked    = TRUE,
//            blocked_reason = 'Terlalu banyak percobaan login gagal',
//            blocked_at     = NOW(),
//            updated_at     = NOW()
//          WHERE id = $1 AND is_blocked = FALSE`,
//         [user.id],
//       );
//       await pool.query(
//         `INSERT INTO account_lock_log
//            (user_id, action, trigger_type, reason)
//          VALUES ($1,'lock','failed_login','Auto-lock: 5+ gagal login')`,
//         [user.id],
//       );
//       await pool.query(
//         `INSERT INTO notifications (user_id, type, title, message)
//          VALUES ($1,'account_locked',
//            'Akun Anda Dikunci Otomatis',
//            'Akun Anda dikunci karena terlalu banyak percobaan login gagal. Hubungi admin.')`,
//         [user.id],
//       );
//     }
//     console.log(`[CRON] Auto-lock login: ${rows.length} akun dikunci`);
//   } catch (err) {
//     console.error("[CRON] Auto-lock error:", err.message);
//   }
// });
// ─── Auto-lock berdasarkan gagal login: DINONAKTIFKAN ────────
// Fitur ini tidak dipakai di sistem ini (hanya auto-lock overdue
// return yang aktif). Cron sebelumnya menyebabkan bug: view
// `auto_lock_candidates` menghitung SEMUA kegagalan login
// sepanjang sejarah tanpa batasan waktu, sehingga user yang
// pernah salah password beberapa kali di masa lalu (meski sudah
// lama & sejak itu selalu berhasil login) tetap ter-lock begitu
// akumulasi historisnya menembus ambang batas. Dinonaktifkan.

// ─── Setiap jam: tandai overdue + kirim notif W1 ─────────────
// 🔧 FIX: Sekarang juga kirim W1 notification untuk yang baru overdue
cron.schedule("0 * * * *", async () => {
  try {
    // Ambil loan yang BARU melewati deadline (belum pernah dapat warning)
    const { rows: newOverdue } = await pool.query(
      `SELECT lr.id, lr.requester_id, a.name AS asset_name
       FROM loan_requests lr
       JOIN assets a ON a.id = lr.asset_id
       WHERE lr.status = 'picked_up'
         AND lr.return_deadline < CURRENT_DATE
         AND lr.warning_count = 0`,
    );

    for (const loan of newOverdue) {
      // Mark overdue + set W1
      await pool.query(
        `UPDATE loan_requests
         SET status = 'overdue',
             warning_count = 1,
             last_warning_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [loan.id],
      );

      // ✅ Kirim notif W1 ke peminjam
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, 'loan_overdue',
           '⚠️ Peringatan: Barang Terlambat Dikembalikan',
           $2, '/pinjaman')`,
        [
          loan.requester_id,
          `"${loan.asset_name}" sudah melewati batas pengembalian! Segera kembalikan ke admin lab sebelum dikenakan sanksi.`,
        ],
      );
    }

    if (newOverdue.length > 0)
      console.log(
        `[CRON] Overdue W1: ${newOverdue.length} peminjaman → overdue + notif dikirim`,
      );
  } catch (err) {
    console.error("[CRON] Overdue error:", err.message);
  }
});

// ─── Setiap hari jam 08:00: reminder H-1 ─────────────────────
// 🔧 FIX 1: Hapus warning_count++ (reminder ≠ warning)
// 🔧 FIX 2: Link diperbaiki → /pinjaman
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
      // ✅ FIX: link ke /pinjaman, bukan /loans/:id
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, 'loan_return_reminder',
           '⏰ Pengingat: Besok Batas Pengembalian',
           $2, '/pinjaman')`,
        [
          loan.requester_id,
          `"${loan.asset_name}" harus dikembalikan besok (${loan.return_deadline}). Harap kembalikan tepat waktu!`,
        ],
      );

      // ✅ FIX: hanya set reminder_sent, TIDAK increment warning_count
      await pool.query(
        `UPDATE loan_requests
         SET reminder_sent = TRUE,
             updated_at = NOW()
         WHERE id = $1`,
        [loan.id],
      );
    }

    if (rows.length > 0)
      console.log(`[CRON] Reminder H-1: ${rows.length} notifikasi dikirim`);
  } catch (err) {
    console.error("[CRON] Reminder error:", err.message);
  }
});

// ─── Setiap hari jam 08:30: Peringatan Kedua (W2) ────────────
// ➕ BARU: 3 hari setelah W1 → kirim W2
cron.schedule("30 8 * * *", async () => {
  try {
    const { rows } = await pool.query(
      `SELECT lr.id, lr.requester_id, a.name AS asset_name
       FROM loan_requests lr
       JOIN assets a ON a.id = lr.asset_id
       WHERE lr.status = 'overdue'
         AND lr.warning_count = 1
         AND lr.last_warning_at::date <= CURRENT_DATE - INTERVAL '3 days'`,
    );

    for (const loan of rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, 'loan_overdue',
           '🚨 Peringatan Kedua: Segera Kembalikan',
           $2, '/pinjaman')`,
        [
          loan.requester_id,
          `Ini adalah peringatan TERAKHIR untuk "${loan.asset_name}". Jika tidak dikembalikan dalam 3 hari, akun Anda akan dikunci otomatis.`,
        ],
      );

      await pool.query(
        `UPDATE loan_requests
         SET warning_count = 2,
             last_warning_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [loan.id],
      );
    }

    if (rows.length > 0)
      console.log(`[CRON] Warning W2: ${rows.length} peringatan kedua dikirim`);
  } catch (err) {
    console.error("[CRON] Warning W2 error:", err.message);
  }
});

// ─── Setiap hari jam 09:00: Auto-lock setelah W2 ─────────────
// ➕ BARU: 3 hari setelah W2 → lock akun
cron.schedule("0 9 * * *", async () => {
  try {
    const { rows } = await pool.query(
      `SELECT lr.id, lr.requester_id, a.name AS asset_name
       FROM loan_requests lr
       JOIN assets a ON a.id = lr.asset_id
       WHERE lr.status = 'overdue'
         AND lr.warning_count = 2
         AND lr.last_warning_at::date <= CURRENT_DATE - INTERVAL '3 days'`,
    );

    for (const loan of rows) {
      // Lock akun user
      await pool.query(
        `UPDATE profiles
         SET is_blocked = TRUE,
             auto_locked = TRUE,
             blocked_reason = $2,
             blocked_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [
          loan.requester_id,
          `Akun dikunci otomatis karena terlambat mengembalikan "${loan.asset_name}". Selesaikan peminjaman untuk membuka akses.`,
        ],
      );

      // Catat di account_lock_log
      await pool.query(
        `INSERT INTO account_lock_log
           (user_id, action, trigger_type, reason)
         VALUES ($1, 'lock', 'overdue_return', $2)`,
        [
          loan.requester_id,
          `Auto-lock: terlambat mengembalikan "${loan.asset_name}" (loan: ${loan.id})`,
        ],
      );

      // Notif ke user
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, 'account_locked',
           '🔒 Akun Dikunci Otomatis',
           $2, '/pesan')`,
        [
          loan.requester_id,
          `Akun Anda dikunci karena belum mengembalikan "${loan.asset_name}". Hubungi admin lab untuk membuka akses.`,
        ],
      );

      // Set warning_count = 3 supaya tidak diproses lagi
      await pool.query(
        `UPDATE loan_requests
         SET warning_count = 3,
             updated_at = NOW()
         WHERE id = $1`,
        [loan.id],
      );
    }

    if (rows.length > 0)
      console.log(`[CRON] Auto-lock overdue: ${rows.length} akun dikunci`);
  } catch (err) {
    console.error("[CRON] Auto-lock overdue error:", err.message);
  }
});

// ─── Setiap malam jam 00:05: auto-unlock berdasarkan unlock_at ─
// (tidak berubah)
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
