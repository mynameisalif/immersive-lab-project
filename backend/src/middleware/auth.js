const jwt = require("jsonwebtoken");
const pool = require("../config/db");

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ message: "Token tidak ditemukan" });

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await pool.query(
      "SELECT id, is_blocked, blocked_reason, auto_locked, is_kaprodi FROM profiles WHERE id = $1",
      [decoded.userId],
    );

    if (!rows[0])
      return res.status(401).json({ message: "User tidak ditemukan" });

    if (rows[0].is_blocked)
      return res.status(403).json({
        message: rows[0].auto_locked
          ? "Akun dikunci otomatis. Hubungi admin."
          : `Akun diblokir: ${rows[0].blocked_reason}`,
      });

    req.user = {
      ...decoded,
      id: decoded.userId,
      isKaprodi: rows[0].is_kaprodi === true,
    };
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Token tidak valid atau sudah kadaluarsa" });
  }
};
