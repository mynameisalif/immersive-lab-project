const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// ─── Register ────────────────────────────────────────────────
exports.register = async (req, res) => {
  const {
    email,
    full_name,
    nim_nip,
    phone,
    role = "student",
    password,
  } = req.body;

  // Validasi field wajib
  if (!email || !full_name || !password)
    return res
      .status(400)
      .json({ message: "Email, nama, dan password wajib diisi" });

  const validRoles = ["student", "dosen", "admin"];
  if (!validRoles.includes(role))
    return res.status(400).json({ message: "Role tidak valid" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Cek email sudah terdaftar
    const exist = await client.query(
      "SELECT id FROM profiles WHERE email = $1",
      [email],
    );
    if (exist.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Email sudah terdaftar" });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 12);

    // Insert ke profiles dengan password_hash sekaligus
    const { rows } = await client.query(
      `INSERT INTO profiles (email, full_name, nim_nip, phone, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name`,
      [email, full_name, nim_nip || null, phone || null, hashed],
    );
    const user = rows[0];

    // Insert role
    await client.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`,
      [user.id, role],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Registrasi berhasil",
      data: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Register error:", err.message);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      detail: err.message,
    });
  } finally {
    client.release();
  }
};

// ─── Login ───────────────────────────────────────────────────
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email dan password wajib diisi" });

  try {
    const userRow = await pool.query(
      `SELECT p.id, p.email, p.full_name, p.password_hash,
              p.is_blocked, p.blocked_reason, p.auto_locked,
              ur.role
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       WHERE p.email = $1
       LIMIT 1`,
      [email],
    );

    const userFound = userRow.rows.length > 0;
    const isSuccess =
      userFound &&
      (await bcrypt.compare(password, userRow.rows[0].password_hash || ""));

    // Simpan log login attempt
    await pool.query(
      `INSERT INTO login_attempts (user_id, email, success)
       VALUES ($1, $2, $3)`,
      [userFound ? userRow.rows[0].id : null, email, isSuccess],
    );

    if (!isSuccess)
      return res.status(401).json({ message: "Email atau password salah" });

    const user = userRow.rows[0];

    // Cek akun diblokir
    if (user.is_blocked)
      return res.status(403).json({
        message: user.auto_locked
          ? "Akun dikunci otomatis karena terlalu banyak percobaan login gagal. Hubungi admin."
          : `Akun diblokir. Alasan: ${user.blocked_reason}`,
      });

    // Cek auto-lock (5x gagal dalam 1 jam)
    const failCount = await pool.query(
      `SELECT COUNT(*) FROM login_attempts
       WHERE user_id = $1 AND success = FALSE
         AND attempted_at > NOW() - INTERVAL '1 hour'`,
      [user.id],
    );

    if (parseInt(failCount.rows[0].count) >= 5) {
      await pool.query(
        `UPDATE profiles SET
           is_blocked = TRUE, auto_locked = TRUE,
           blocked_reason = 'Terlalu banyak percobaan login gagal',
           blocked_at = NOW()
         WHERE id = $1`,
        [user.id],
      );
      await pool.query(
        `INSERT INTO account_lock_log (user_id, action, trigger_type, reason)
         VALUES ($1, 'lock', 'failed_login', 'Auto-lock: 5+ gagal login dalam 1 jam')`,
        [user.id],
      );
      return res.status(403).json({
        message: "Akun dikunci otomatis. Hubungi admin untuk membuka.",
      });
    }

    // Buat JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    return res.status(200).json({
      message: "Login berhasil",
      token,
      data: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      detail: err.message,
    });
  }
};

// ─── Get Profile ─────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.email, p.full_name, p.nim_nip, p.phone,
              p.is_blocked, p.created_at, ur.role
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       WHERE p.id = $1`,
      [req.user.userId],
    );
    if (!rows[0])
      return res.status(404).json({ message: "User tidak ditemukan" });
    return res.json({ data: rows[0] });
  } catch (err) {
    console.error("getProfile error:", err.message);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      detail: err.message,
    });
  }
};

// ─── Logout ───────────────────────────────────────────────────
exports.logout = (req, res) => {
  return res.json({ message: "Logout berhasil. Hapus token di sisi client." });
};

// ─── Register Admin ───────────────────────────────────────────
exports.registerAdmin = async (req, res) => {
  await exports.register(req, res, "admin");
};

// ─── Register Dosen ────────────────────────────────────────────
exports.registerDosen = async (req, res) => {
  await exports.register(req, res, "dosen");
};

// ─── Register Mahasiswa ─────────────────────────────────────────
exports.registerMahasiswa = async (req, res) => {
  await exports.register(req, res, "student");
};
