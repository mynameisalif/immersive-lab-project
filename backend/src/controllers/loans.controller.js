const pool = require("../config/db");
const path = require("path");

// Helper: kirim notifikasi ke user
async function sendNotif(client, userId, type, title, message, link = null) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, message, link],
  );
}

// ─── GET semua peminjaman (filter by role) ────────────────────
exports.getAllLoans = async (req, res) => {
  try {
    let query,
      params = [];

    if (req.user.role === "student") {
      // Mahasiswa: hanya lihat milik sendiri
      query = `
        SELECT lr.*, a.name AS asset_name, a.merk, a.type,
               p.full_name AS requester_name,
               d.full_name AS dosen_name
        FROM loan_requests lr
        JOIN assets a ON a.id = lr.asset_id
        JOIN profiles p ON p.id = lr.requester_id
        LEFT JOIN profiles d ON d.id = lr.dosen_id
        WHERE lr.requester_id = $1
        ORDER BY lr.created_at DESC`;
      params = [req.user.userId];
    } else if (req.user.role === "dosen") {
      // Dosen: lihat milik sendiri + yang perlu disetujui (dosen_id = diri sendiri)
      query = `
        SELECT lr.*, a.name AS asset_name, a.merk, a.type,
               p.full_name AS requester_name,
               d.full_name AS dosen_name
        FROM loan_requests lr
        JOIN assets a ON a.id = lr.asset_id
        JOIN profiles p ON p.id = lr.requester_id
        LEFT JOIN profiles d ON d.id = lr.dosen_id
        WHERE lr.requester_id = $1 OR lr.dosen_id = $1
        ORDER BY lr.created_at DESC`;
      params = [req.user.userId];
    } else {
      // Admin: lihat semua
      query = `
        SELECT lr.*, a.name AS asset_name, a.merk, a.type,
               p.full_name AS requester_name,
               d.full_name AS dosen_name
        FROM loan_requests lr
        JOIN assets a ON a.id = lr.asset_id
        JOIN profiles p ON p.id = lr.requester_id
        LEFT JOIN profiles d ON d.id = lr.dosen_id
        ORDER BY lr.created_at DESC`;
    }

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error("getAllLoans error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── GET detail satu peminjaman ───────────────────────────────
exports.getLoanById = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT lr.*, a.name AS asset_name, a.merk, a.type,
              p.full_name AS requester_name, p.nim_nip,
              d.full_name AS dosen_name,
              json_agg(json_build_object(
                'unit_code', au.unit_code,
                'condition', lua.return_condition,
                'notes', lua.return_notes
              )) FILTER (WHERE au.id IS NOT NULL) AS assigned_units
       FROM loan_requests lr
       JOIN assets a ON a.id = lr.asset_id
       JOIN profiles p ON p.id = lr.requester_id
       LEFT JOIN profiles d ON d.id = lr.dosen_id
       LEFT JOIN loan_unit_assignments lua ON lua.loan_request_id = lr.id
       LEFT JOIN asset_units au ON au.id = lua.asset_unit_id
       WHERE lr.id = $1
       GROUP BY lr.id, a.name, a.merk, a.type,
                p.full_name, p.nim_nip, d.full_name`,
      [req.params.id],
    );
    if (!rows[0])
      return res.status(404).json({ message: "Peminjaman tidak ditemukan" });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error("getLoanById error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── POST ajukan peminjaman baru ──────────────────────────────
exports.createLoan = async (req, res) => {
  const {
    asset_id,
    quantity,
    category,
    borrow_date,
    return_deadline,
    dosen_id,
    notes,
  } = req.body;

  // Validasi field wajib
  if (!asset_id || !quantity || !category || !borrow_date || !return_deadline)
    return res.status(400).json({ message: "Semua field wajib diisi" });

  if (new Date(return_deadline) < new Date(borrow_date))
    return res.status(400).json({
      message: "Tanggal kembali tidak boleh sebelum tanggal pinjam",
    });

  if (req.user.role === "student" && !dosen_id)
    return res.status(400).json({ message: "Dosen pembimbing wajib dipilih" });

  if (req.user.role === "student" && category === "event_kegiatan" && !req.file)
    return res.status(400).json({
      message: "Proposal kegiatan wajib diupload untuk kategori event",
    });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Cek & ambil unit yang tersedia (kondisi good & loan_status tersedia)
    const stockRes = await client.query(
      `SELECT id FROM asset_units
       WHERE asset_id = $1 
         AND condition = 'good' 
         AND loan_status = 'tersedia'
       LIMIT $2`,
      [asset_id, quantity],
    );

    if (stockRes.rows.length < quantity) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Stok tidak mencukupi. Tersedia: ${stockRes.rows.length} unit`,
      });
    }

    const attachment_url = req.file ? `/uploads/${req.file.filename}` : null;
    const attachment_name = req.file ? req.file.originalname : null;
    const attachment_type = req.file
      ? path.extname(req.file.originalname).replace(".", "")
      : null;

    // Insert loan_request
    const { rows } = await client.query(
      `INSERT INTO loan_requests
         (requester_id, asset_id, quantity, category,
          borrow_date, return_deadline, dosen_id, notes,
          attachment_url, attachment_name, attachment_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        req.user.userId,
        asset_id,
        quantity,
        category,
        borrow_date,
        return_deadline,
        req.user.role === "student" ? dosen_id : null,
        notes || null,
        attachment_url,
        attachment_name,
        attachment_type,
      ],
    );

    const loan = rows[0];

    // INSERT ke loan_unit_assignments untuk setiap unit yang dipilih
    // Trigger akan otomatis update loan_status di asset_units
    for (const unit of stockRes.rows) {
      await client.query(
        `INSERT INTO loan_unit_assignments (loan_request_id, asset_unit_id)
         VALUES ($1, $2)`,
        [loan.id, unit.id],
      );
    }

    // Kirim notifikasi ke dosen pembimbing (jika mahasiswa)
    if (req.user.role === "student" && dosen_id) {
      await sendNotif(
        client,
        dosen_id,
        "loan_approval",
        "Permintaan Persetujuan Peminjaman",
        `Ada permintaan peminjaman yang memerlukan persetujuan Anda.`,
        `/approvals/${loan.id}`,
      );
    }

    await client.query("COMMIT");
    res
      .status(201)
      .json({ message: "Peminjaman berhasil diajukan", data: loan });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createLoan error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    client.release();
  }
};

// ─── POST upload proposal (terpisah, jika ingin upload belakangan) ─
exports.uploadProposal = async (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: "File tidak ditemukan" });

  try {
    const { rows } = await pool.query(
      `UPDATE loan_requests SET
         attachment_url  = $1,
         attachment_name = $2,
         attachment_type = $3,
         updated_at = NOW()
       WHERE id = $4 AND requester_id = $5 RETURNING *`,
      [
        `/uploads/${req.file.filename}`,
        req.file.originalname,
        path.extname(req.file.originalname).replace(".", ""),
        req.params.id,
        req.user.userId,
      ],
    );
    if (!rows[0])
      return res.status(404).json({ message: "Peminjaman tidak ditemukan" });
    res.json({ message: "Proposal berhasil diupload", data: rows[0] });
  } catch (err) {
    console.error("uploadProposal error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── PATCH konfirmasi pengambilan (admin) ─────────────────────
// Tambahkan function ini di loans.controller.js
// Letakkan SEBELUM exports.confirmReturn

exports.confirmPickup = async (req, res) => {
  const { unit_ids } = req.body; // array UUID asset_units yang dialokasikan
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const loanRes = await client.query(
      `SELECT * FROM loan_requests WHERE id = $1 AND status = 'approved_admin'`,
      [req.params.id],
    );
    if (!loanRes.rows[0])
      return res.status(400).json({
        message: "Peminjaman belum disetujui admin atau tidak ditemukan",
      });

    const loan = loanRes.rows[0];

    if (!unit_ids || unit_ids.length !== loan.quantity)
      return res.status(400).json({
        message: `Jumlah unit yang dialokasikan harus ${loan.quantity}`,
      });

    // Alokasikan unit & tandai tidak tersedia
    for (const uid of unit_ids) {
      await client.query(
        `INSERT INTO loan_unit_assignments (loan_request_id, asset_unit_id)
         VALUES ($1, $2)`,
        [loan.id, uid],
      );
      await client.query(
        `UPDATE asset_units SET is_available = FALSE WHERE id = $1`,
        [uid],
      );
    }

    // Update status peminjaman
    await client.query(
      `UPDATE loan_requests SET status='picked_up', picked_up_at=NOW(), updated_at=NOW()
       WHERE id = $1`,
      [loan.id],
    );

    // Notifikasi ke peminjam
    await sendNotif(
      client,
      loan.requester_id,
      "loan_pickup",
      "Aset Siap Diambil",
      "Peminjaman Anda telah dikonfirmasi pengambilannya.",
      `/loans/${loan.id}`,
    );

    await client.query("COMMIT");
    res.json({ message: "Pengambilan berhasil dikonfirmasi" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("confirmPickup error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    client.release();
  }
};

// ─── PATCH konfirmasi pengembalian (admin) ────────────────────
// FIXED: Accept both 'picked_up' AND 'approved_admin' status
exports.confirmReturn = async (req, res) => {
  const { unit_conditions } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ✅ FIX: Accept picked_up ATAU approved_admin
    const loanRes = await client.query(
      `SELECT * FROM loan_requests 
       WHERE id = $1 AND status IN ('picked_up', 'approved_admin', 'overdue')`,
      [req.params.id],
    );

    if (!loanRes.rows[0])
      return res.status(400).json({
        message: "Peminjaman tidak ditemukan atau sudah dikembalikan",
      });

    const loan = loanRes.rows[0];

    if (!unit_conditions || unit_conditions.length === 0) {
      return res.status(400).json({ message: "unit_conditions harus ada" });
    }

    for (const uc of unit_conditions) {
      if (!uc.asset_unit_id || !uc.return_condition) {
        return res.status(400).json({
          message: "Setiap unit harus punya asset_unit_id dan return_condition",
        });
      }
    }

    // Update kondisi setiap unit yang dikembalikan
    for (const uc of unit_conditions) {
      await client.query(
        `UPDATE loan_unit_assignments
         SET return_condition = $1, return_notes = $2
         WHERE loan_request_id = $3 AND asset_unit_id = $4`,
        [
          uc.return_condition,
          uc.return_notes || null,
          loan.id,
          uc.asset_unit_id,
        ],
      );
      await client.query(
        `UPDATE asset_units
         SET is_available = TRUE, condition = $1, updated_at = NOW()
         WHERE id = $2`,
        [uc.return_condition || "good", uc.asset_unit_id],
      );
    }

    await client.query(
      `UPDATE loan_requests
       SET status='returned', returned_at=NOW(), updated_at=NOW()
       WHERE id=$1`,
      [loan.id],
    );

    await sendNotif(
      client,
      loan.requester_id,
      "loan_returned",
      "Pengembalian Dikonfirmasi",
      "Aset telah berhasil dikembalikan. Terima kasih.",
      `/loans/${loan.id}`,
    );

    await client.query("COMMIT");
    res.json({ message: "Pengembalian berhasil dikonfirmasi" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("confirmReturn error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    client.release();
  }
};
exports.getLoanUnits = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT au.id, au.unit_code, au.condition, au.loan_status
       FROM loan_unit_assignments lua
       JOIN asset_units au ON lua.asset_unit_id = au.id
       WHERE lua.loan_request_id = $1
       ORDER BY au.unit_code`,
      [id],
    );
    res.json({ data: rows });
  } catch (err) {
    console.error("getLoanUnits error:", err);
    res.status(500).json({ message: "Gagal fetch unit" });
  }
};
