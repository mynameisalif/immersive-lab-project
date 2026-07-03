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

// ─── GET semua peminjaman (filter by role) / Bagian Backend ────────────────────
// ─── GET loans grouped by unique peminjaman (requester + timestamps) ─────────

exports.getAllLoans = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;

  try {
    let roleFilter; // dipakai di WHERE data query (prefix lr./ur. sudah ada di alias)
    let params;

    if (req.user.role === "student") {
      roleFilter = "lr.requester_id = $1";
      params = [req.user.userId];
    } else if (req.user.role === "dosen" && req.user.isKaprodi) {
      // Kaprodi: lihat SEMUA peminjaman mahasiswa
      roleFilter = "ur.role = 'student'";
      params = [];
    } else {
      // dosen biasa, staff, admin -> own loans
      roleFilter = "lr.requester_id = $1";
      params = [req.user.userId];
    }

    // ✅ COUNT: unique peminjaman (subquery DISTINCT - sudah terverifikasi benar)
    const countQuery = `
      SELECT COUNT(*) FROM (
        SELECT DISTINCT lr.requester_id, DATE(lr.borrow_date), lr.return_deadline
        FROM loan_requests lr
        JOIN user_roles ur ON ur.user_id = lr.requester_id
        WHERE ${roleFilter}
      ) grouped`;

    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count) || 0;

    // ✅ DATA: DISTINCT ON (pilih 1 record representatif per grup)
    //    + LATERAL JOIN (agregasi SEMUA asset dalam grup itu, scoped per-row)
    //    Ini TIDAK BISA kehilangan grup karena LATERAL selalu match minimal ke dirinya sendiri.
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const dataParams = [...params, limit, offset];

    const dataQuery = `
      SELECT * FROM (
        SELECT DISTINCT ON (lr.requester_id, DATE(lr.borrow_date), lr.return_deadline)
          lr.id,
          lr.requester_id,
          lr.quantity,
          lr.category,
          lr.borrow_date,
          lr.return_deadline,
          lr.status,
          lr.notes,
          lr.picked_up_at,
          lr.returned_at,
          lr.created_at,
          p.full_name AS requester_name,
          p.nim_nip,
          ur.role AS requester_role,
          batch.assets,
          batch.asset_count
        FROM loan_requests lr
        JOIN profiles p ON p.id = lr.requester_id
        JOIN user_roles ur ON ur.user_id = lr.requester_id
        JOIN LATERAL (
          SELECT
            json_agg(json_build_object(
              'id', a.id,
              'name', a.name,
              'merk', a.merk,
              'type', a.type,
              'quantity', lr2.quantity
            )) AS assets,
            COUNT(*) AS asset_count
          FROM loan_requests lr2
          JOIN assets a ON a.id = lr2.asset_id
          WHERE lr2.requester_id = lr.requester_id
            AND DATE(lr2.borrow_date) = DATE(lr.borrow_date)
            AND lr2.return_deadline = lr.return_deadline
        ) batch ON true
        WHERE ${roleFilter}
        ORDER BY lr.requester_id, DATE(lr.borrow_date), lr.return_deadline, lr.created_at DESC
      ) grouped_loans
      ORDER BY grouped_loans.borrow_date DESC, grouped_loans.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const { rows } = await pool.query(dataQuery, dataParams);

    // ✅ Transform: asset_name/merk/type dari asset pertama (untuk display utama)
    const transformedRows = rows.map((row) => ({
      ...row,
      asset_name:
        row.assets && row.assets.length > 0 ? row.assets[0].name : "—",
      merk: row.assets && row.assets.length > 0 ? row.assets[0].merk : null,
      type: row.assets && row.assets.length > 0 ? row.assets[0].type : null,
    }));

    res.json({
      data: transformedRows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
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
                json_agg(json_build_object(
                  'unit_code', au.unit_code,
                  'condition', lua.return_condition,
                  'notes', lua.return_notes
                )) FILTER (WHERE au.id IS NOT NULL) AS assigned_units
        FROM loan_requests lr
        JOIN assets a ON a.id = lr.asset_id
        JOIN profiles p ON p.id = lr.requester_id
        LEFT JOIN loan_unit_assignments lua ON lua.loan_request_id = lr.id
        LEFT JOIN asset_units au ON au.id = lua.asset_unit_id
        WHERE lr.id = $1
        GROUP BY lr.id, a.name, a.merk, a.type, p.full_name, p.nim_nip`,
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
  const { asset_id, quantity, category, borrow_date, return_deadline, notes } =
    req.body;

  if (!asset_id || !quantity || !category || !borrow_date || !return_deadline)
    return res.status(400).json({ message: "Semua field wajib diisi" });

  if (new Date(return_deadline) < new Date(borrow_date))
    return res.status(400).json({
      message: "Tanggal kembali tidak boleh sebelum tanggal pinjam",
    });

  const requesterRole = req.user.role;

  if (requesterRole === "student" && category === "event_kegiatan" && !req.file)
    return res.status(400).json({
      message: "Proposal kegiatan wajib diupload untuk kategori event",
    });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const stockRes = await client.query(
      `SELECT id FROM asset_units
        WHERE asset_id = $1 AND condition = 'good' AND loan_status = 'tersedia'
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

    // ✅ Set initial status based on requester role
    // Student → pending (menunggu kaprodi/dosen pembimbing)
    // Dosen / Staff → approved_dosen (skip kaprodi step, langsung ke admin)
    const initialStatus =
      requesterRole === "student" ? "pending" : "approved_dosen";

    const { rows } = await client.query(
      `INSERT INTO loan_requests
          (requester_id, asset_id, quantity, category,
            borrow_date, return_deadline, notes,
            attachment_url, attachment_name, attachment_type, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *`,
      [
        req.user.userId,
        asset_id,
        quantity,
        category,
        borrow_date,
        return_deadline,
        notes || null,
        attachment_url,
        attachment_name,
        attachment_type,
        initialStatus,
      ],
    );

    const loan = rows[0];

    for (const unit of stockRes.rows) {
      await client.query(
        `INSERT INTO loan_unit_assignments (loan_request_id, asset_unit_id)
          VALUES ($1, $2)`,
        [loan.id, unit.id],
      );
    }

    // Routing notifikasi berdasarkan role
    if (requesterRole === "student") {
      // Student → notif ke semua kaprodi
      // ✅ JOIN user_roles untuk cek is_kaprodi
      const kaprodiRes = await client.query(
        `SELECT p.id FROM profiles p
          JOIN user_roles ur ON ur.user_id = p.id
          WHERE ur.role = 'dosen' AND p.is_kaprodi = TRUE`,
      );
      for (const kp of kaprodiRes.rows) {
        await sendNotif(
          client,
          kp.id,
          "loan_approval",
          "Permintaan Peminjaman Mahasiswa",
          "Ada permintaan peminjaman mahasiswa yang memerlukan persetujuan Anda.",
          `/approvals`,
        );
      }
    } else {
      // Staff / Dosen biasa / Kaprodi → notif ke admin
      // ✅ JOIN user_roles untuk cari admin
      const adminRes = await client.query(
        `SELECT p.id FROM profiles p
          JOIN user_roles ur ON ur.user_id = p.id
          WHERE ur.role = 'admin'`,
      );
      for (const adm of adminRes.rows) {
        await sendNotif(
          client,
          adm.id,
          "loan_approval",
          "Permintaan Peminjaman Baru",
          `Ada permintaan peminjaman dari ${requesterRole} yang memerlukan persetujuan Anda.`,
          `/approvals`,
        );
      }
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

// ─── POST upload proposal ─────────────────────────────────────
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
exports.confirmPickup = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Cek loan ada dan statusnya approved_admin
    const loanRes = await client.query(
      `SELECT lr.*, a.name AS asset_name
        FROM loan_requests lr
        JOIN assets a ON a.id = lr.asset_id
        WHERE lr.id = $1 AND lr.status = 'approved_admin'`,
      [req.params.id],
    );

    if (!loanRes.rows[0])
      return res.status(400).json({
        message: "Peminjaman belum disetujui admin atau tidak ditemukan",
      });

    const loan = loanRes.rows[0];

    // Cek unit sudah di-assign (dari createLoan)
    const unitCheck = await client.query(
      `SELECT COUNT(*) as count
        FROM loan_unit_assignments
        WHERE loan_request_id = $1`,
      [loan.id],
    );

    if (parseInt(unitCheck.rows[0].count) === 0)
      return res.status(400).json({
        message: "Unit belum di-assign ke peminjaman ini",
      });

    // Update status ke picked_up + catat waktu pengambilan
    await client.query(
      `UPDATE loan_requests
        SET status = 'picked_up',
            picked_up_at = NOW(),
            updated_at = NOW()
        WHERE id = $1`,
      [loan.id],
    );
    // ✅ Trigger DB (trg_loan_status_change) otomatis update
    //    loan_status unit → 'dipinjam' dan is_available = false

    // Notifikasi ke peminjam
    await sendNotif(
      client,
      loan.requester_id,
      "loan_pickup",
      "✅ Barang Siap Diambil",
      `Peminjaman "${loan.asset_name}" telah dikonfirmasi. Silakan ambil barang di admin lab.`,
      "/pinjaman",
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
// ✅ TAMBAH endpoint baru di backend/src/controllers/loans.controller.js

// ─── GET semua peminjaman yang siap diambil (approved_admin) ────
// Endpoint khusus untuk halaman pengambilan
// Hanya admin yang bisa akses, menampilkan SEMUA loans dengan status approved_admin
exports.getApprovedForPickup = async (req, res) => {
  // ✅ FIX 1: Pagination params
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;

  try {
    // ✅ FIX 2: Cek role (hanya admin)
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    // ✅ FIX 3: COUNT SEMUA loans dengan status approved_admin
    const countQuery = `
      SELECT COUNT(*) FROM loan_requests
      WHERE status = 'approved_admin'`;

    // ✅ FIX 4: SELECT SEMUA loans dengan status approved_admin + LIMIT/OFFSET
    const query = `
      SELECT lr.*, a.name AS asset_name, a.merk, a.type,
             p.full_name AS requester_name, p.nim_nip,
             ur.role AS requester_role
      FROM loan_requests lr
      JOIN assets a ON a.id = lr.asset_id
      JOIN profiles p ON p.id = lr.requester_id
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE lr.status = 'approved_admin'
      ORDER BY lr.created_at ASC
      LIMIT $1 OFFSET $2`;

    // Count total
    const countRes = await pool.query(countQuery);
    const total = parseInt(countRes.rows[0].count);

    // Execute dengan LIMIT & OFFSET
    const { rows } = await pool.query(query, [limit, offset]);

    // Return dengan pagination
    res.json({
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getApprovedForPickup error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── GET semua peminjaman yang siap dikembalikan (picked_up/overdue) ─────────
// Endpoint khusus untuk halaman pengembalian
// Hanya admin yang bisa akses, menampilkan SEMUA loans dengan status picked_up/overdue
// Support pagination
exports.getReturnPending = async (req, res) => {
  // ✅ FIX 1: Pagination params
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;

  try {
    // ✅ FIX 2: Cek role (hanya admin)
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    // ✅ FIX 3: COUNT SEMUA loans dengan status picked_up atau overdue
    const countQuery = `
      SELECT COUNT(*) FROM loan_requests
      WHERE status IN ('picked_up', 'overdue')`;

    // ✅ FIX 4: SELECT SEMUA loans dengan status picked_up/overdue + LIMIT/OFFSET
    const query = `
      SELECT lr.*, a.name AS asset_name, a.merk, a.type,
             p.full_name AS requester_name, p.nim_nip,
             ur.role AS requester_role
      FROM loan_requests lr
      JOIN assets a ON a.id = lr.asset_id
      JOIN profiles p ON p.id = lr.requester_id
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE lr.status IN ('picked_up', 'overdue')
      ORDER BY lr.return_deadline ASC, lr.created_at ASC
      LIMIT $1 OFFSET $2`;

    // Count total
    const countRes = await pool.query(countQuery);
    const total = parseInt(countRes.rows[0].count);

    // Execute dengan LIMIT & OFFSET
    const { rows } = await pool.query(query, [limit, offset]);

    // Return dengan pagination
    res.json({
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getReturnPending error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// ─── PATCH konfirmasi pengembalian (admin) ────────────────────
// TAMBAHAN dari sebelumnya:
//   - Auto-unlock user jika sebelumnya di-lock karena overdue
//   - Catat unlock di account_lock_log
//   - Fix notif link → /pinjaman
exports.confirmReturn = async (req, res) => {
  const { unit_conditions } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const loanRes = await client.query(
      `SELECT lr.*, a.name AS asset_name
        FROM loan_requests lr
        JOIN assets a ON a.id = lr.asset_id
        WHERE lr.id = $1 AND lr.status IN ('picked_up', 'approved_admin', 'overdue')`,
      [req.params.id],
    );

    if (!loanRes.rows[0])
      return res.status(400).json({
        message: "Peminjaman tidak ditemukan atau sudah dikembalikan",
      });

    const loan = loanRes.rows[0];

    if (!unit_conditions || unit_conditions.length === 0)
      return res.status(400).json({ message: "unit_conditions harus ada" });

    for (const uc of unit_conditions) {
      if (!uc.asset_unit_id || !uc.return_condition)
        return res.status(400).json({
          message: "Setiap unit harus punya asset_unit_id dan return_condition",
        });
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
          SET condition = $1, updated_at = NOW()
          WHERE id = $2`,
        [uc.return_condition || "good", uc.asset_unit_id],
      );
      // ✅ Trigger DB otomatis update loan_status unit → 'tersedia'
    }

    // Update status loan → returned
    await client.query(
      `UPDATE loan_requests
        SET status = 'returned',
            returned_at = NOW(),
            updated_at = NOW()
        WHERE id = $1`,
      [loan.id],
    );

    // ✅ FIX BARU: Auto-unlock user jika di-lock karena overdue
    const profileRes = await client.query(
      `SELECT is_blocked, auto_locked FROM profiles WHERE id = $1`,
      [loan.requester_id],
    );

    const wasAutoLocked = profileRes.rows[0]?.auto_locked === true;

    if (wasAutoLocked) {
      await client.query(
        `UPDATE profiles
          SET is_blocked = false,
              auto_locked = false,
              blocked_reason = null,
              blocked_at = null,
              updated_at = NOW()
          WHERE id = $1`,
        [loan.requester_id],
      );

      // Catat unlock di account_lock_log
      await client.query(
        `INSERT INTO account_lock_log
            (user_id, action, trigger_type, reason, unlocked_by)
          VALUES ($1, 'unlock', 'overdue_return', $2, $3)`,
        [
          loan.requester_id,
          `Auto-unlock: barang "${loan.asset_name}" telah dikembalikan`,
          req.user.id,
        ],
      );

      // Notif ke user: akun dibuka kembali
      await sendNotif(
        client,
        loan.requester_id,
        "account_unlocked",
        "🔓 Akun Dibuka Kembali",
        `Akun Anda telah dibuka kembali setelah mengembalikan "${loan.asset_name}".`,
        "/pinjaman",
      );
    }

    // Notifikasi pengembalian ke peminjam
    await sendNotif(
      client,
      loan.requester_id,
      "loan_returned",
      "✅ Pengembalian Dikonfirmasi",
      `"${loan.asset_name}" telah berhasil dikembalikan. Terima kasih!`,
      "/pinjaman",
    );

    await client.query("COMMIT");
    res.json({
      message: "Pengembalian berhasil dikonfirmasi",
      auto_unlocked: wasAutoLocked,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("confirmReturn error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    client.release();
  }
};

// ─── GET semua peminjaman untuk laporan (report) dengan pagination ──────────
// Endpoint khusus untuk halaman laporan
// Hanya admin yang bisa akses, menampilkan SEMUA loans tanpa filter
// Support pagination: ?page=1&limit=10
exports.getAllLoansForReport = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;

  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    const countQuery = `
      SELECT COUNT(*) FROM (
        SELECT DISTINCT lr.requester_id, DATE(lr.borrow_date), lr.return_deadline
        FROM loan_requests lr
      ) grouped`;

    const countRes = await pool.query(countQuery);
    const total = parseInt(countRes.rows[0].count) || 0;

    const dataQuery = `
      SELECT * FROM (
        SELECT DISTINCT ON (lr.requester_id, DATE(lr.borrow_date), lr.return_deadline)
          lr.id,
          lr.requester_id,
          lr.quantity,
          lr.category,
          lr.borrow_date,
          lr.return_deadline,
          lr.status,
          lr.notes,
          lr.picked_up_at,
          lr.returned_at,
          lr.created_at,
          p.full_name AS requester_name,
          p.nim_nip,
          ur.role AS requester_role,
          batch.assets,
          batch.asset_count
        FROM loan_requests lr
        JOIN profiles p ON p.id = lr.requester_id
        JOIN user_roles ur ON ur.user_id = lr.requester_id
        JOIN LATERAL (
          SELECT
            json_agg(json_build_object(
              'id', a.id,
              'name', a.name,
              'merk', a.merk,
              'type', a.type,
              'quantity', lr2.quantity
            )) AS assets,
            COUNT(*) AS asset_count
          FROM loan_requests lr2
          JOIN assets a ON a.id = lr2.asset_id
          WHERE lr2.requester_id = lr.requester_id
            AND DATE(lr2.borrow_date) = DATE(lr.borrow_date)
            AND lr2.return_deadline = lr.return_deadline
        ) batch ON true
        ORDER BY lr.requester_id, DATE(lr.borrow_date), lr.return_deadline, lr.created_at DESC
      ) grouped_loans
      ORDER BY grouped_loans.borrow_date DESC, grouped_loans.created_at DESC
      LIMIT $1 OFFSET $2`;

    const { rows } = await pool.query(dataQuery, [limit, offset]);

    const transformedRows = rows.map((row) => ({
      ...row,
      asset_name:
        row.assets && row.assets.length > 0 ? row.assets[0].name : "—",
      merk: row.assets && row.assets.length > 0 ? row.assets[0].merk : null,
      type: row.assets && row.assets.length > 0 ? row.assets[0].type : null,
    }));

    res.json({
      data: transformedRows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getAllLoansForReport error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};
// ─── GET unit yang terkait peminjaman ─────────────────────────
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

// GET /api/loans/stats — agregat KPI untuk Dashboard (tanpa pagination,
// hitung LANGSUNG di database, bukan di frontend dari data terpotong)
exports.getLoanStats = async (req, res) => {
  try {
    let whereClause = "";
    let params = [];

    if (req.user.role === "admin") {
      // Admin: semua loan di sistem, tanpa filter
      whereClause = "";
    } else if (req.user.role === "dosen" && req.user.isKaprodi) {
      // Kaprodi: semua loan milik mahasiswa
      whereClause = "WHERE ur.role = 'student'";
    } else {
      // Dosen biasa / staff / student: hanya milik sendiri
      whereClause = "WHERE lr.requester_id = $1";
      params = [req.user.id];
    }

    const query = `
      SELECT
        COUNT(*) FILTER (WHERE lr.status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE lr.status = 'approved_dosen') AS approved_dosen,
        COUNT(*) FILTER (WHERE lr.status = 'approved_admin') AS approved_admin,
        COUNT(*) FILTER (WHERE lr.status = 'picked_up') AS picked_up,
        COUNT(*) FILTER (WHERE lr.status = 'returned') AS returned,
        COUNT(*) FILTER (WHERE lr.status = 'rejected') AS rejected,
        COUNT(*) FILTER (WHERE lr.status = 'overdue') AS overdue,
        COUNT(*) FILTER (
          WHERE lr.status = 'overdue'
             OR (lr.status = 'returned' AND lr.returned_at > lr.return_deadline)
             OR (lr.status IN ('picked_up','approved_admin','approved_dosen') AND lr.return_deadline < NOW())
        ) AS terlambat
      FROM loan_requests lr
      JOIN user_roles ur ON ur.user_id = lr.requester_id
      ${whereClause}`;

    const { rows } = await pool.query(query, params);
    const r = rows[0];

    res.json({
      data: {
        pending: parseInt(r.pending) || 0,
        approved_dosen: parseInt(r.approved_dosen) || 0,
        approved_admin: parseInt(r.approved_admin) || 0,
        picked_up: parseInt(r.picked_up) || 0,
        returned: parseInt(r.returned) || 0,
        rejected: parseInt(r.rejected) || 0,
        overdue: parseInt(r.overdue) || 0,
        terlambat: parseInt(r.terlambat) || 0,
      },
    });
  } catch (err) {
    console.error("getLoanStats error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// GET /api/loans/recent — data mentah (1 baris per aset, TIDAK di-group)
// untuk 24 jam terakhir. Dipakai Dashboard yang sudah punya logic
// grouping sendiri di frontend (groupLoans by 10s window).
exports.getRecentLoans = async (req, res) => {
  try {
    let whereClause = "lr.created_at >= NOW() - INTERVAL '24 hours'";
    let params = [];

    if (req.user.role === "admin") {
      // tidak ada filter tambahan
    } else if (req.user.role === "dosen" && req.user.isKaprodi) {
      whereClause += " AND ur.role = 'student'";
    } else {
      whereClause += " AND lr.requester_id = $1";
      params = [req.user.id];
    }

    const query = `
      SELECT
        lr.id,
        lr.quantity,
        lr.category,
        lr.status,
        lr.borrow_date,
        lr.returned_at,
        lr.return_deadline,
        lr.created_at,
        a.name AS asset_name,
        lr.requester_id,
        p.full_name AS requester_name
      FROM loan_requests lr
      JOIN assets a ON a.id = lr.asset_id
      JOIN profiles p ON p.id = lr.requester_id
      JOIN user_roles ur ON ur.user_id = lr.requester_id
      WHERE ${whereClause}
      ORDER BY lr.created_at DESC
      LIMIT 200`;

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error("getRecentLoans error:", err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};
