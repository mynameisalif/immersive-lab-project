const pool = require("../config/db");

// Helper: kirim notifikasi
async function sendNotif(client, userId, type, title, message, link = null) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, message, link],
  );
}

// Helper: cek apakah user adalah kaprodi
async function getIsKaprodi(userId) {
  const { rows } = await pool.query(
    `SELECT is_kaprodi FROM profiles WHERE id = $1`,
    [userId],
  );
  return rows[0]?.is_kaprodi === true;
}

// Helper: kirim notif ke semua admin (FIXED)
// ✅ Tambah logging dan error handling
async function notifyAllAdmins(client, type, title, message, link) {
  try {
    const { rows } = await client.query(
      `SELECT p.id 
       FROM profiles p
       JOIN user_roles ur ON ur.user_id = p.id
       WHERE ur.role = 'admin'`,
    );

    if (rows.length === 0) {
      console.warn("notifyAllAdmins: No admins found");
      return;
    }

    for (const admin of rows) {
      await sendNotif(client, admin.id, type, title, message, link);
    }
    console.log(`notifyAllAdmins: Sent to ${rows.length} admin(s)`);
  } catch (err) {
    console.error("notifyAllAdmins error:", err);
    throw err;
  }
}

// ─── GET pending requests ──────────────────────────────────────
exports.getPending = async (req, res) => {
  const { role, userId } = req.user;
  try {
    let query;

    if (role === "dosen") {
      const isKaprodi = await getIsKaprodi(userId);
      if (!isKaprodi) {
        return res.status(403).json({ message: "Akses ditolak" });
      }

      query = `
        SELECT lr.*,
               a.name AS asset_name, a.merk, a.type,
               p.full_name AS requester_name, p.nim_nip,
               ur.role AS requester_role
        FROM loan_requests lr
        JOIN assets a ON a.id = lr.asset_id
        JOIN profiles p ON p.id = lr.requester_id
        JOIN user_roles ur ON ur.user_id = p.id
        WHERE lr.status = 'pending'
          AND ur.role = 'student'
        ORDER BY lr.created_at ASC`;
    } else if (role === "admin") {
      query = `
        SELECT lr.*,
               a.name AS asset_name, a.merk, a.type,
               p.full_name AS requester_name, p.nim_nip,
               ur.role AS requester_role
        FROM loan_requests lr
        JOIN assets a ON a.id = lr.asset_id
        JOIN profiles p ON p.id = lr.requester_id
        JOIN user_roles ur ON ur.user_id = p.id
        WHERE lr.status = 'approved_dosen'
           OR (lr.status = 'pending' AND ur.role IN ('staff', 'dosen'))
        ORDER BY lr.created_at ASC`;
    } else {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    const { rows } = await pool.query(query);
    res.json({ data: rows });
  } catch (err) {
    console.error("getPending error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── POST approve ──────────────────────────────────────────────
exports.approve = async (req, res) => {
  const { role, userId } = req.user;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT lr.*, ur.role AS requester_role, p.full_name AS requester_name
       FROM loan_requests lr
       JOIN profiles p ON p.id = lr.requester_id
       JOIN user_roles ur ON ur.user_id = p.id
       WHERE lr.id = $1`,
      [req.params.id],
    );
    if (!rows[0])
      return res.status(404).json({ message: "Peminjaman tidak ditemukan" });

    const loan = rows[0];

    // ── KAPRODI APPROVE ────────────────────────────────────────
    if (role === "dosen") {
      const isKaprodi = await getIsKaprodi(userId);
      if (!isKaprodi) return res.status(403).json({ message: "Akses ditolak" });

      if (loan.status !== "pending" || loan.requester_role !== "student")
        return res.status(400).json({
          message: "Hanya bisa approve permintaan pending dari mahasiswa",
        });

      await client.query(
        `UPDATE loan_requests 
         SET status = 'approved_dosen', updated_at = NOW() 
         WHERE id = $1`,
        [loan.id],
      );

      // ✅ Notif ke admin
      await notifyAllAdmins(
        client,
        "loan_approval",
        "Permintaan Menunggu Approval Admin",
        `Peminjaman dari ${loan.requester_name} telah disetujui Kaprodi.`,
        `/approvals`,
      );

      // ✅ Notif ke peminjam
      await sendNotif(
        client,
        loan.requester_id,
        "loan_approved_dosen",
        "Disetujui Kaprodi ✓",
        "Peminjaman Anda telah disetujui Kepala Prodi. Menunggu konfirmasi Admin.",
        `/pinjaman`,
      );

      // ── ADMIN APPROVE ──────────────────────────────────────────
    } else if (role === "admin") {
      const isApprovedDosenStatus = loan.status === "approved_dosen";
      const isPendingStaffOrDosen =
        loan.status === "pending" &&
        ["staff", "dosen"].includes(loan.requester_role);

      if (!isApprovedDosenStatus && !isPendingStaffOrDosen)
        return res.status(400).json({
          message: "Status peminjaman tidak valid untuk diapprove",
        });

      await client.query(
        `UPDATE loan_requests 
         SET status = 'approved_admin', updated_at = NOW() 
         WHERE id = $1`,
        [loan.id],
      );

      // ✅ Notif ke peminjam
      await sendNotif(
        client,
        loan.requester_id,
        "loan_approved_admin",
        "Disetujui Admin ✓",
        "Peminjaman Anda telah disetujui. Silakan ambil aset di lab.",
        `/pinjaman`,
      );
    } else {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    await client.query("COMMIT");
    res.json({ message: "Peminjaman berhasil diapprove" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("approve error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    client.release();
  }
};

// ─── POST reject ───────────────────────────────────────────────
exports.reject = async (req, res) => {
  const { role, userId } = req.user;
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT lr.*, ur.role AS requester_role
       FROM loan_requests lr
       JOIN profiles p ON p.id = lr.requester_id
       JOIN user_roles ur ON ur.user_id = p.id
       WHERE lr.id = $1`,
      [req.params.id],
    );
    if (!rows[0])
      return res.status(404).json({ message: "Peminjaman tidak ditemukan" });

    const loan = rows[0];

    if (role === "dosen") {
      const isKaprodi = await getIsKaprodi(userId);
      if (
        !isKaprodi ||
        loan.status !== "pending" ||
        loan.requester_role !== "student"
      )
        return res
          .status(400)
          .json({ message: "Tidak dapat menolak peminjaman ini" });
    } else if (role === "admin") {
      const isApprovedDosenStatus = loan.status === "approved_dosen";
      const isPendingStaffOrDosen =
        loan.status === "pending" &&
        ["staff", "dosen"].includes(loan.requester_role);
      if (!isApprovedDosenStatus && !isPendingStaffOrDosen)
        return res
          .status(400)
          .json({ message: "Status tidak valid untuk ditolak" });
    } else {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    await client.query(
      `UPDATE loan_requests 
       SET status = 'rejected', rejection_reason = $1, updated_at = NOW() 
       WHERE id = $2`,
      [reason || null, loan.id],
    );

    // ✅ Notif ke peminjam
    await sendNotif(
      client,
      loan.requester_id,
      "loan_rejected",
      "Peminjaman Ditolak",
      `Peminjaman Anda ditolak.${reason ? " Alasan: " + reason : ""}`,
      `/pinjaman`,
    );

    await client.query("COMMIT");
    res.json({ message: "Peminjaman berhasil ditolak" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("reject error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    client.release();
  }
};
