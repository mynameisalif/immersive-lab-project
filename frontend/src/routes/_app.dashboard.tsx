import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  Clock,
  History,
  ShieldCheck,
  Plus,
  AlertTriangle,
  CheckSquare,
  Boxes,
  Users,
  PackageX,
  PackageSearch,
} from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { KpiCard } from "../components/common/KpiCard";
import { StatusBadge, type LoanStatus } from "../components/common/StatusBadge";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/auth";
import { Link } from "@tanstack/react-router";
import { getLoans } from "../services/loan.service";
import api from "../lib/api";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · MNP Lab Loan" }] }),
});

const formatDate = (d: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
};

function Dashboard() {
  const { role } = useAuth();
  if (role === "admin") return <AdminDashboard />;
  if (role === "dosen") return <DosenDashboard />;
  return <StudentDashboard />;
}

// ============================================================
// STUDENT DASHBOARD
// ============================================================
function StudentDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ aktif: 0, pending: 0, total: 0 });
  const [recent, setRecent] = useState<
    Array<{
      id: string;
      status: string;
      notes: string;
      created_at: string;
    }>
  >([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const res = await getLoans();
        const all = res.data?.data ?? [];
        setStats({
          aktif: all.filter((r: any) =>
            ["approved_admin", "picked_up"].includes(r.status),
          ).length,
          pending: all.filter((r: any) =>
            ["pending", "approved_dosen"].includes(r.status),
          ).length,
          total: all.length,
        });
        setRecent(
          all.slice(0, 5).map((r: any) => ({
            id: r.id,
            status: r.status,
            notes: r.notes ?? r.purpose ?? "—",
            created_at: r.created_at,
          })),
        );
      } catch {
        // silent fail
      }
    })();
  }, [user]);

  const mapStatus = (s: string): LoanStatus => {
    const map: Record<string, LoanStatus> = {
      pending: "pending_dosen",
      approved_dosen: "pending_admin",
      approved_admin: "approved",
      picked_up: "picked_up",
      returned: "returned",
      rejected: "rejected",
      overdue: "overdue",
    };
    return (map[s] ?? s) as LoanStatus;
  };

  return (
    <>
      <PageHeader
        title={`Halo, ${profile?.full_name?.split(" ")[0] ?? "Mahasiswa"} 👋`}
        description="Berikut ringkasan aktivitas peminjaman aset lab Anda."
        actions={
          <Button asChild variant="brand" size="lg">
            <Link to="/pinjaman">
              <Plus className="size-4" /> Ajukan Peminjaman
            </Link>
          </Button>
        }
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Pinjaman Aktif"
          value={stats.aktif}
          icon={ClipboardList}
          tone="primary"
        />
        <KpiCard
          label="Menunggu Approval"
          value={stats.pending}
          icon={Clock}
          tone="warning"
        />
        <KpiCard
          label="Total Riwayat"
          value={stats.total}
          icon={History}
          tone="accent"
        />
        <KpiCard
          label="Status Akun"
          value={profile?.is_blocked ? "Terkunci" : "Aktif"}
          icon={ShieldCheck}
          tone={profile?.is_blocked ? "destructive" : "success"}
        />
      </div>

      <div className="mt-8 rounded-xl border bg-card shadow-(--shadow-card)">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-display text-base font-semibold">
            Aktivitas Terkini
          </h2>
          <Button asChild variant="ghost-navy" size="sm">
            <Link to="/pinjaman">Lihat semua</Link>
          </Button>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Belum ada peminjaman.
          </div>
        ) : (
          <ul className="divide-y">
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ClipboardList className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.notes}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {r.id.slice(0, 8)} · {formatDate(r.created_at)}
                  </p>
                </div>
                <StatusBadge status={mapStatus(r.status)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ============================================================
// DOSEN DASHBOARD
// ============================================================
function DosenDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ pending: 0, approved: 0 });

  useEffect(() => {
    void (async () => {
      try {
        const res = await getLoans();
        const all = res.data?.data ?? [];
        setStats({
          pending: all.filter((r: any) => r.status === "pending").length,
          approved: all.filter((r: any) =>
            [
              "approved_admin",
              "approved_dosen",
              "picked_up",
              "returned",
            ].includes(r.status),
          ).length,
        });
      } catch {
        // silent fail
      }
    })();
  }, []);

  return (
    <>
      <PageHeader
        title={`Halo, ${profile?.full_name ?? "Dosen"} 👋`}
        description="Permintaan peminjaman dari mahasiswa bimbingan Anda."
        actions={
          <Button asChild variant="brand">
            <Link to="/approval">
              <CheckSquare className="size-4" /> Ke Approval
            </Link>
          </Button>
        }
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Menunggu Persetujuan"
          value={stats.pending}
          icon={Clock}
          tone="warning"
        />
        <KpiCard
          label="Sudah Disetujui"
          value={stats.approved}
          icon={CheckSquare}
          tone="success"
        />
        <KpiCard
          label="Total Mahasiswa"
          value="—"
          icon={Users}
          tone="primary"
          hint="Akan datang"
        />
      </div>
    </>
  );
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================
interface RecentLoan {
  id: string;
  status: string;
  category: string;
  borrow_date: string;
  requester_name?: string;
  asset_name?: string;
  merk?: string | null;
  type?: string | null;
}

function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    pendingAdmin: 0,
    dipinjam: 0,
    terlambat: 0,
    blocked: 0,
    totalAsset: 0,
    aktif: 0,
    stokMenipis: 0,
  });
  const [recent, setRecent] = useState<RecentLoan[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        // Load loan stats
        const loansRes = await getLoans();
        const all = loansRes.data?.data ?? [];
        const today = new Date().toISOString().slice(0, 10);

        // Load asset stats
        const assetsRes = await api.get("/api/assets/stats");
        const assetStats = assetsRes.data?.data ?? {};

        // Load user stats
        const usersRes = await api.get("/api/users/stats");
        const userStats = usersRes.data?.data ?? {};

        setStats({
          pendingAdmin: all.filter((r: any) => r.status === "approved_dosen")
            .length,
          dipinjam: all.filter((r: any) => r.status === "picked_up").length,
          aktif: all.filter((r: any) =>
            ["approved_admin", "picked_up"].includes(r.status),
          ).length,
          terlambat: all.filter(
            (r: any) =>
              (r.status === "picked_up" || r.status === "overdue") &&
              r.return_deadline &&
              r.return_deadline < today,
          ).length,
          blocked: userStats.blocked ?? 0,
          totalAsset: assetStats.totalAsset ?? 0,
          stokMenipis: assetStats.stokMenipis ?? 0,
        });

        setRecent(
          all.slice(0, 8).map((r: any) => ({
            id: r.id,
            status: r.status,
            category: r.category,
            borrow_date: r.borrow_date,
            requester_name: r.requester_name ?? "—",
            asset_name: r.asset_name ?? "—",
            merk: r.merk ?? null,
            type: r.type ?? null,
          })),
        );
      } catch (err) {
        console.error("Failed to load dashboard stats:", err);
        // silent fail
      }
    })();
  }, []);

  const mapStatus = (s: string): LoanStatus => {
    const map: Record<string, LoanStatus> = {
      pending: "pending_dosen",
      approved_dosen: "pending_admin",
      approved_admin: "approved",
      picked_up: "picked_up",
      returned: "returned",
      rejected: "rejected",
      overdue: "overdue",
    };
    return (map[s] ?? s) as LoanStatus;
  };

  const getAssetLabel = (r: RecentLoan) => {
    const parts = [r.merk, r.type].filter(Boolean).join(" ");
    return parts || r.asset_name;
  };

  return (
    <>
      <PageHeader
        title={`Halo, ${profile?.full_name?.split(" ")[0] ?? "Admin"} 👋`}
        description="Ringkasan operasional lab hari ini."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Aset"
          value={stats.totalAsset}
          icon={Boxes}
          tone="accent"
        />
        <KpiCard
          label="Peminjaman Aktif"
          value={stats.aktif}
          icon={ClipboardList}
          tone="primary"
        />
        <KpiCard
          label="Stok Menipis"
          value={stats.stokMenipis}
          icon={PackageSearch}
          tone="warning"
          hint="Tersedia ≤ 1"
        />
        <KpiCard
          label="Pending Final"
          value={stats.pendingAdmin}
          icon={Clock}
          tone="warning"
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Sedang Dipinjam"
          value={stats.dipinjam}
          icon={ClipboardList}
          tone="primary"
        />
        <KpiCard
          label="Terlambat"
          value={stats.terlambat}
          icon={AlertTriangle}
          tone="destructive"
        />
        <KpiCard
          label="User Terblokir"
          value={stats.blocked}
          icon={PackageX}
          tone="destructive"
        />
      </div>

      <div className="mt-8 rounded-xl border bg-card shadow-(--shadow-card)">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-display text-base font-semibold">
            Peminjaman Terbaru
          </h2>
          <Button asChild variant="ghost-navy" size="sm">
            <Link to="/pinjaman">Lihat semua</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Peminjam</th>
                <th className="px-4 py-3">Aset</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recent.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                recent.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">{r.requester_name}</td>
                    <td className="px-4 py-3">{getAssetLabel(r)}</td>
                    <td className="px-4 py-3">
                      {r.category === "kelas_praktikum"
                        ? "Kelas / Praktikum"
                        : r.category === "event_kegiatan"
                          ? "Event / Kegiatan"
                          : r.category}
                    </td>
                    <td className="px-4 py-3">{formatDate(r.borrow_date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={mapStatus(r.status)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
