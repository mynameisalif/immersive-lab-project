import api from "@/lib/api";

// GET /api/users — ambil semua user
export const getAllUsers = async () => {
  const res = await api.get("/api/users");
  return res.data?.data ?? [];
};

// GET /api/users/dosen — ambil daftar dosen
export const getDosen = async () => {
  const res = await api.get("/api/users/dosen");
  return res.data?.data ?? [];
};

// PATCH /api/users/:id/block — kunci/buka akun
export const blockUnblockUser = async (
  id: string,
  is_blocked: boolean,
  reason?: string,
) =>
  api.patch(`/api/users/${id}/block`, {
    is_blocked,
    reason: reason ?? null,
  });

// GET /api/users/notifications — ambil notifikasi user
export const getNotifications = async () => {
  const res = await api.get("/api/users/notifications");
  return res.data?.data ?? [];
};

// PATCH /api/users/notifications/mark-all-read — tandai semua notifikasi dibaca
export const markAllNotificationsRead = async () =>
  api.patch(`/api/users/notifications/mark-all-read`);

// PATCH /api/users/notifications/:id/read — tandai notifikasi dibaca
export const markNotifRead = async (notifId: string) =>
  api.patch(`/api/users/notifications/${notifId}/read`);
