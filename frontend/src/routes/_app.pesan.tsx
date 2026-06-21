import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Mail, Search, Trash2, Eye, Loader2 } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import api from "../lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pesan")({
  component: Pesan,
  head: () => ({ meta: [{ title: "Pesan · MNP Lab Loan" }] }),
});

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

function Pesan() {
  const navigate = useNavigate(); // ✅ TanStack Router navigation
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/notifications");
      setNotifications(res.data?.data ?? []);
    } catch (err) {
      console.error("Error loading notifications:", err);
      toast.error("Gagal memuat pesan");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      setMarking(id);
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      toast.success("Pesan ditandai sudah dibaca");
    } catch (err) {
      console.error("Error marking as read:", err);
      toast.error("Gagal tandai pesan");
    } finally {
      setMarking(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      await api.delete(`/api/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Pesan dihapus");
    } catch (err) {
      console.error("Error deleting notification:", err);
      toast.error("Gagal hapus pesan");
    } finally {
      setDeleting(null);
    }
  };

  // ✅ Handle "Lihat Detail" navigation using TanStack Router
  const handleNavigateToLink = (link: string) => {
    // Map notification links to correct TanStack Router paths
    const linkMap: Record<string, string> = {
      "/approvals": "/approval",
      "/approvals/": "/approval",
      "/loans": "/pinjaman",
      "/loans/": "/pinjaman",
      "/peminjaman": "/pinjaman",
    };

    // Normalize the link
    const normalizedLink = linkMap[link] ?? link;

    try {
      navigate({ to: normalizedLink as any });
    } catch {
      // Fallback jika route tidak ada
      console.warn("Route not found:", normalizedLink);
      toast.error("Halaman tidak ditemukan");
    }
  };

  useEffect(() => {
    void loadNotifications();
    const interval = setInterval(() => void loadNotifications(), 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = notifications.filter((n) =>
    [n.title, n.message, n.type]
      .filter(Boolean)
      .some((v) => v && v.toLowerCase().includes(search.toLowerCase())),
  );

  const getTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; variant: any }> = {
      loan_request_pending: {
        label: "Permintaan Peminjaman",
        variant: "outline",
      },
      loan_request_approved_dosen: {
        label: "Disetujui Kaprodi",
        variant: "secondary",
      },
      loan_request_approved_admin: {
        label: "Disetujui Admin",
        variant: "default",
      },
      loan_approved_admin: { label: "Disetujui Admin", variant: "default" },
      loan_request_rejected: { label: "Ditolak", variant: "destructive" },
      loan_pickup_reminder: {
        label: "Pengingat Pengambilan",
        variant: "outline",
      },
      loan_return_reminder: {
        label: "Pengingat Pengembalian",
        variant: "outline",
      },
      loan_overdue: { label: "Terlambat", variant: "destructive" },
      test: { label: "Test", variant: "outline" },
    };
    const config = typeMap[type] || { label: type, variant: "outline" };
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  return (
    <>
      <PageHeader
        title="Pesan"
        description="Riwayat pesan dan pemberitahuan terkait peminjaman Anda."
      />

      {/* Search bar */}
      <div className="mt-6 mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari pesan..."
          className="pl-9"
        />
      </div>

      {/* Notifications list */}
      {loading && notifications.length === 0 ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
          Memuat pesan...
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Mail}
            title="Belum ada pesan"
            description={
              notifications.length === 0
                ? "Belum ada pesan masuk. Pesan akan muncul ketika ada aktivitas peminjaman."
                : "Tidak ada pesan yang cocok dengan pencarian."
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((notification) => (
            <div
              key={notification.id}
              className={`border rounded-lg p-4 transition ${
                notification.is_read
                  ? "bg-muted/30 opacity-70"
                  : "bg-card border-primary/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm">
                      {notification.title}
                    </h3>
                    {getTypeBadge(notification.type)}
                    {!notification.is_read && (
                      <span className="inline-block h-2 w-2 rounded-full bg-primary ml-auto" />
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">
                    {notification.message}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString("id-ID")}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  {!notification.is_read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMarkAsRead(notification.id)}
                      disabled={marking === notification.id}
                      title="Tandai sudah dibaca"
                    >
                      {marking === notification.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(notification.id)}
                    disabled={deleting === notification.id}
                    title="Hapus pesan"
                  >
                    {deleting === notification.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* ✅ Link action - pakai navigate() bukan <a href> */}
              {notification.link && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleNavigateToLink(notification.link!)}
                  >
                    Lihat Detail
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {notifications.length > 0 && (
        <div className="mt-6 text-xs text-muted-foreground text-center">
          ⏱️ Pesan diperbarui otomatis setiap 5 detik
        </div>
      )}
    </>
  );
}
