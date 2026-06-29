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

// ── Group notifikasi yang dikirim bersamaan ───────────────────
interface NotifGroup {
  groupKey: string;
  type: string;
  title: string;
  is_read: boolean;
  created_at: string;
  link?: string;
  items: Notification[];
}

const GROUP_WINDOW_MS = 10_000; // FIX: 10 detik

function groupNotifications(items: Notification[]): NotifGroup[] {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const groups: NotifGroup[] = [];
  for (const item of sorted) {
    const existing = groups.find(
      (g) =>
        g.type === item.type &&
        Math.abs(
          new Date(g.created_at).getTime() -
            new Date(item.created_at).getTime(),
        ) <= GROUP_WINDOW_MS,
    );
    if (existing) {
      existing.items.push(item);
      if (!item.is_read) existing.is_read = false;
    } else {
      groups.push({
        groupKey: item.id,
        type: item.type,
        title: item.title,
        is_read: item.is_read,
        created_at: item.created_at,
        link: item.link,
        items: [item],
      });
    }
  }
  return groups;
}

function Pesan() {
  const navigate = useNavigate();
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
    } catch {
      toast.error("Gagal memuat pesan");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Mark semua notifikasi dalam group sebagai dibaca
  const handleMarkGroupAsRead = async (group: NotifGroup) => {
    setMarking(group.groupKey);
    try {
      for (const notif of group.items) {
        if (!notif.is_read) {
          await api.patch(`/api/notifications/${notif.id}/read`);
        }
      }
      setNotifications((prev) =>
        prev.map((n) =>
          group.items.find((i) => i.id === n.id) ? { ...n, is_read: true } : n,
        ),
      );
      toast.success(
        group.items.length > 1
          ? `${group.items.length} pesan ditandai sudah dibaca`
          : "Pesan ditandai sudah dibaca",
      );
    } catch {
      toast.error("Gagal tandai pesan");
    } finally {
      setMarking(null);
    }
  };

  // ✅ Hapus semua notifikasi dalam group
  const handleDeleteGroup = async (group: NotifGroup) => {
    setDeleting(group.groupKey);
    try {
      for (const notif of group.items) {
        await api.delete(`/api/notifications/${notif.id}`);
      }
      setNotifications((prev) =>
        prev.filter((n) => !group.items.find((i) => i.id === n.id)),
      );
      toast.success(
        group.items.length > 1
          ? `${group.items.length} pesan dihapus`
          : "Pesan dihapus",
      );
    } catch {
      toast.error("Gagal hapus pesan");
    } finally {
      setDeleting(null);
    }
  };

  const handleNavigateToLink = (link: string) => {
    const linkMap: Record<string, string> = {
      "/approvals": "/approval",
      "/approvals/": "/approval",
      "/loans": "/pinjaman",
      "/loans/": "/pinjaman",
      "/peminjaman": "/pinjaman",
    };
    try {
      navigate({ to: (linkMap[link] ?? link) as any });
    } catch {
      toast.error("Halaman tidak ditemukan");
    }
  };

  useEffect(() => {
    void loadNotifications();
    const interval = setInterval(() => void loadNotifications(), 5000);
    return () => clearInterval(interval);
  }, []);

  const allGroups = groupNotifications(notifications);

  const filtered = allGroups.filter(
    (g) =>
      !search ||
      [g.title, ...g.items.map((i) => i.message), g.type].some((v) =>
        v?.toLowerCase().includes(search.toLowerCase()),
      ),
  );

  const getTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; variant: any }> = {
      loan_approval: { label: "Permintaan Peminjaman", variant: "outline" },
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
      loan_pickup: { label: "Siap Diambil", variant: "default" },
      loan_returned: { label: "Dikembalikan", variant: "default" },
      account_locked: { label: "Akun Dikunci", variant: "destructive" },
      account_unlocked: { label: "Akun Dibuka", variant: "default" },
    };
    const config = typeMap[type] ?? { label: type, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <>
      <PageHeader
        title="Pesan"
        description="Riwayat pesan dan pemberitahuan terkait peminjaman Anda."
      />

      {/* Search */}
      <div className="mt-6 mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari pesan..."
          className="pl-9"
        />
      </div>

      {/* List */}
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
          {filtered.map((group) => {
            const isMulti = group.items.length > 1;
            const isMarkingThis = marking === group.groupKey;
            const isDeletingThis = deleting === group.groupKey;

            return (
              <div
                key={group.groupKey}
                className={`border rounded-lg p-4 transition ${
                  group.is_read
                    ? "bg-muted/30 opacity-70"
                    : "bg-card border-primary/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title + badges */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-medium text-sm">{group.title}</h3>
                      {getTypeBadge(group.type)}
                      {/* Badge jumlah aset jika grouped */}
                      {isMulti && (
                        <Badge variant="secondary" className="text-xs">
                          {group.items.length} aset
                        </Badge>
                      )}
                      {!group.is_read && (
                        <span className="inline-block h-2 w-2 rounded-full bg-primary ml-auto shrink-0" />
                      )}
                    </div>

                    {/* Messages */}
                    {isMulti ? (
                      <ul className="mt-1 space-y-0.5">
                        {group.items.map((item) => (
                          <li
                            key={item.id}
                            className="text-sm text-muted-foreground"
                          >
                            • {item.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground mb-2">
                        {group.items[0].message}
                      </p>
                    )}

                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {new Date(group.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    {!group.is_read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkGroupAsRead(group)}
                        disabled={!!marking}
                        title="Tandai sudah dibaca"
                      >
                        {isMarkingThis ? (
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
                      onClick={() => handleDeleteGroup(group)}
                      disabled={!!deleting}
                      title="Hapus pesan"
                    >
                      {isDeletingThis ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Link */}
                {group.link && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleNavigateToLink(group.link!)}
                    >
                      Lihat Detail
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
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
