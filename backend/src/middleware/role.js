// Gunakan setelah middleware auth.js
// Contoh: router.get('/admin-only', authenticate, requireRole('admin'), handler)

module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ message: "Tidak terautentikasi" });

    if (!allowedRoles.includes(req.user.role))
      return res.status(403).json({
        message: `Akses ditolak. Diperlukan role: ${allowedRoles.join(" atau ")}`,
      });

    next();
  };
};
