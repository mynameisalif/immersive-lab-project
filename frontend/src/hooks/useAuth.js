// ============================================================
// user.service.js
// ============================================================
import api from "@/lib/api";

// GET semua user (admin)
export const getAllUsers = async () => {
  const res = await api.get("/api/users");
  return res.data;
};

// GET detail user by ID (admin)
export const getUserById = async (id) => {
  const res = await api.get(`/api/users/${id}`);
  return res.data;
};

// GET daftar dosen aktif (untuk dropdown form peminjaman mahasiswa)
export const getDosen = async () => {
  const res = await api.get("/api/users/dosen");
  return res.data;
};

// PATCH lock akun (admin)
export const blockUser = async (id, reason, unlockAt = null) => {
  const res = await api.patch(`/api/users/${id}/block`, {
    reason,
    unlock_at: unlockAt,
  });
  return res.data;
};

// PATCH unlock akun (admin)
export const unblockUser = async (id) => {
  const res = await api.patch(`/api/users/${id}/unblock`);
  return res.data;
};

// GET kandidat auto-lock
export const getLockCandidates = async () => {
  const res = await api.get("/api/users/lock-candidates");
  return res.data;
};

// GET log lock/unlock
export const getLockLog = async () => {
  const res = await api.get("/api/users/lock-log");
  return res.data;
};

// GET notifikasi milik user yang login
export const getNotifications = async () => {
  const res = await api.get("/api/users/notifications/me");
  return res.data;
};

// PATCH tandai notifikasi sudah dibaca
export const markNotifRead = async (notifId) => {
  const res = await api.patch(`/api/users/notifications/${notifId}/read`);
  return res.data;
};
