const pool = require("../config/db");

// Helper notifikasi
async function sendNotif(client, userId, type, title, message, link = null) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES ($1,$2,$3,$4,$5)`,
    [userId, type, title, message, link],
  );
}

// ─── GET daftar peminjaman menunggu persetujuan ───────────────
exports.getPendingApprovals = async (req, res) => {
  try {
    let query,
      params = [];

    if (req.user.role === "dosen") {
      // Dosen: hanya yang ditujukan ke diri sendiri & masih pending
      query = `
        SELECT lr.*, a.name AS asset_name, a.merk, a.type,
               p.full_name AS requester_name, p.nim_nip
        FROM loan_requests lr
        JOIN assets a ON a.id = lr.asset_id
        JOIN profiles p ON p.id = lr.requester_id
        WHERE lr.dosen_id = $1 AND lr.status = 'pending'
        ORDER BY lr.created_at ASC`;
      params = [req.user.userId];
    } else if (req.user.role === "admin") {
      // Admin: yang sudah disetujui dosen (atau dosen null, langsung ke admin)
      query = `
        SELECT lr.*, a.name AS asset_name, a.merk, a.type,
               p.full_name AS requester_name, p.nim_nip,
               d.full_name AS dosen_name
        FROM loan_requests lr
        JOIN assets a ON a.id = lr.asset_id
        JOIN profiles p ON p.id = lr.requester_id
        LEFT JOIN profiles d ON d.id = lr.dosen_id
        WHERE lr.status IN ('pending', 'approved_dosen')
          AND (lr.dosen_id IS NULL OR lr.status = 'approved_dosen')
        ORDER BY lr.created_at ASC`;
    } else {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error("getPendingApprovals error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── POST setujui peminjaman ──────────────────────────────────
exports.approveLoan = async (req, res) => {
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const loanRes = await client.query(
      `SELECT * FROM loan_requests WHERE id = $1`,
      [req.params.id],
    );
    if (!loanRes.rows[0])
      return res.status(404).json({ message: "Peminjaman tidak ditemukan" });

    const loan = loanRes.rows[0];
    let newStatus, approvalLevel;

    if (req.user.role === "dosen") {
      // Validasi: hanya dosen yang ditunjuk yang bisa approve
      if (loan.dosen_id !== req.user.userId)
        return res
          .status(403)
          .json({ message: "Anda bukan dosen pembimbing peminjaman ini" });
      if (loan.status !== "pending")
        return res
          .status(400)
          .json({ message: "Peminjaman tidak dalam status pending" });
      newStatus = "approved_dosen";
      approvalLevel = "dosen";

      // Notifikasi ke admin untuk proses selanjutnya
      const admins = await client.query(
        `SELECT p.id FROM profiles p
         JOIN user_roles ur ON ur.user_id = p.id
         WHERE ur.role = 'admin'`,
      );
      for (const a of admins.rows) {
        await sendNotif(
          client,
          a.id,
          "loan_approval",
          "Peminjaman Menunggu Persetujuan Admin",
          `Peminjaman telah disetujui dosen dan menunggu persetujuan admin.`,
          `/approvals/${loan.id}`,
        );
      }
    } else if (req.user.role === "admin") {
      const validStatuses = ["pending", "approved_dosen"];
      if (!validStatuses.includes(loan.status))
        return res
          .status(400)
          .json({ message: "Status peminjaman tidak valid untuk disetujui" });
      newStatus = "approved_admin";
      approvalLevel = "admin";
    } else {
      return res
        .status(403)
        .json({ message: "Hanya dosen atau admin yang dapat menyetujui" });
    }

    // Simpan record persetujuan
    await client.query(
      `INSERT INTO loan_approvals
         (loan_request_id, approver_id, level, decision, reason)
       VALUES ($1,$2,$3,'approve',$4)`,
      [loan.id, req.user.userId, approvalLevel, reason || null],
    );

    // Update status peminjaman
    await client.query(
      `UPDATE loan_requests SET status=$1, updated_at=NOW() WHERE id=$2`,
      [newStatus, loan.id],
    );

    // Notifikasi ke peminjam
    const msg =
      req.user.role === "dosen"
        ? "Peminjaman Anda telah disetujui dosen. Menunggu persetujuan admin."
        : "Peminjaman Anda telah disetujui admin. Silakan ambil aset sesuai jadwal.";

    await sendNotif(
      client,
      loan.requester_id,
      "loan_approved",
      "Peminjaman Disetujui",
      msg,
      `/loans/${loan.id}`,
    );

    await client.query("COMMIT");
    res.json({
      message: `Peminjaman berhasil disetujui oleh ${req.user.role}`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("approveLoan error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    client.release();
  }
};

// ─── POST tolak peminjaman ────────────────────────────────────
exports.rejectLoan = async (req, res) => {
  const { reason } = req.body;
  if (!reason)
    return res.status(400).json({ message: "Alasan penolakan wajib diisi" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const loanRes = await client.query(
      `SELECT * FROM loan_requests WHERE id = $1`,
      [req.params.id],
    );
    if (!loanRes.rows[0])
      return res.status(404).json({ message: "Peminjaman tidak ditemukan" });

    const loan = loanRes.rows[0];

    // Validasi hak akses
    if (req.user.role === "dosen" && loan.dosen_id !== req.user.userId)
      return res
        .status(403)
        .json({ message: "Anda bukan dosen pembimbing peminjaman ini" });

    if (!["pending", "approved_dosen"].includes(loan.status))
      return res
        .status(400)
        .json({ message: "Peminjaman tidak dapat ditolak pada status ini" });

    const approvalLevel = req.user.role === "dosen" ? "dosen" : "admin";

    await client.query(
      `INSERT INTO loan_approvals
         (loan_request_id, approver_id, level, decision, reason)
       VALUES ($1,$2,$3,'reject',$4)`,
      [loan.id, req.user.userId, approvalLevel, reason],
    );

    await client.query(
      `UPDATE loan_requests
       SET status='rejected', reject_reason=$1, updated_at=NOW()
       WHERE id=$2`,
      [reason, loan.id],
    );

    await sendNotif(
      client,
      loan.requester_id,
      "loan_rejected",
      "Peminjaman Ditolak",
      `Peminjaman Anda ditolak. Alasan: ${reason}`,
      `/loans/${loan.id}`,
    );

    await client.query("COMMIT");
    res.json({ message: "Peminjaman berhasil ditolak" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("rejectLoan error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    client.release();
  }
};

// ─── GET riwayat persetujuan satu peminjaman ──────────────────
exports.getApprovalHistory = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT la.*, p.full_name AS approver_name, p.email
       FROM loan_approvals la
       JOIN profiles p ON p.id = la.approver_id
       WHERE la.loan_request_id = $1
       ORDER BY la.created_at ASC`,
      [req.params.id],
    );
    res.json({ data: rows });
  } catch (err) {
    console.error("getApprovalHistory error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};
