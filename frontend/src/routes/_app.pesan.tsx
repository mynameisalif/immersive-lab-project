import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNotifications, markNotifRead } from "@/services/user.service";
import api from "@/lib/api";

export const Route = createFileRoute("/_app/pesan")({
  component: PesanPage,
  head: () => ({ meta: [{ title: "Pesan · MNP Lab Loan" }] }),
});

interface N {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  link: string | null;
}

// Format tanggal manual (fix hydration)
const formatDate = (d: string) => {
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = pad(dt.getDate());
  const month = pad(dt.getMonth() + 1);
  const year = dt.getFullYear();
  const hour = pad(dt.getHours());
  const min = pad(dt.getMinutes());
  return `${day}/${month}/${year} ${hour}:${min}`;
};

function PesanPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<N[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await getNotifications();
      const data: N[] = (res.data?.data ?? []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        is_read: n.is_read,
        created_at: n.created_at,
        link: n.link ?? null,
      }));
      // Sort by created_at descending
      data.sort(
        (a: N, b: N) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user]);

  const markAll = async () => {
    if (!user) return;
    try {
      // Update semua unread notif menjadi read
      await api.patch("/api/users/notifications/mark-all-read");
      void load();
    } catch {
      // silent fail
    }
  };

  const markOne = async (id: string) => {
    try {
      await markNotifRead(id);
      // Update UI optimistically
      setRows((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch {
      // silent fail
    }
  };

  return (
    <>
      <PageHeader
        title="Pesan"
        description="Riwayat pesan dan pemberitahuan terkait peminjaman Anda."
        actions={
          <Button variant="ghost-navy" onClick={markAll} disabled={loading}>
            Tandai semua dibaca
          </Button>
        }
      />

      {loading ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Memuat pesan…
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={MessageSquare}
            title="Belum ada pesan"
            description="Pesan akan muncul di sini."
          />
        </div>
      ) : (
        <ul className="mt-6 divide-y rounded-xl border bg-card shadow-(--shadow-card)">
          {rows.map((n) => (
            <li
              key={n.id}
              onClick={() => markOne(n.id)}
              className={cn(
                "flex cursor-pointer gap-3 px-5 py-4 transition-colors hover:bg-muted/40",
                !n.is_read && "bg-accent/5",
              )}
            >
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                {/* Format tanggal manual, bukan toLocaleString */}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatDate(n.created_at)}
                </p>
              </div>
              {!n.is_read && (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
