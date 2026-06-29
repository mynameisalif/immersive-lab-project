import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Boxes,
  AlertCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  PackageCheck,
  PackageOpen,
  Hourglass,
  Package,
} from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · MNP Lab Loan" }] }),
});

interface LoanRequest {
  id: string;
  quantity: number;
  category: string;
  status: string;
  borrow_date: string;
  returned_at?: string | null;
  return_deadline: string;
  created_at: string;
  asset_name: string;
  requester_id: string; // ✅ tambah untuk grouping
  requester_name: string;
}

// ── Loan Group ────────────────────────────────────────────────
interface LoanGroup {
  groupKey: string;
  requester_id: string;
  requester_name: string;
  status: string;
  borrow_date: string;
  return_deadline: string;
  created_at: string;
  category: string;
  items: LoanRequest[];
}

// ✅ Grouping 10 detik — mencegah batch berbeda waktu menyatu
const GROUP_WINDOW_MS = 10_000;

function groupLoans(loans: LoanRequest[]): LoanGroup[] {
  const sorted = [...loans].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const groups: LoanGroup[] = [];
  for (const item of sorted) {
    const existing = groups.find(
      (g) =>
        g.requester_id === item.requester_id &&
        g.borrow_date === item.borrow_date &&
        g.return_deadline === item.return_deadline &&
        g.category === item.category &&
        Math.abs(
          new Date(g.created_at).getTime() -
            new Date(item.created_at).getTime(),
        ) <= GROUP_WINDOW_MS,
    );
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({
        groupKey: item.id,
        requester_id: item.requester_id,
        requester_name: item.requester_name,
        status: item.status,
        borrow_date: item.borrow_date,
        return_deadline: item.return_deadline,
        created_at: item.created_at,
        category: item.category,
        items: [item],
      });
    }
  }
  return groups;
}

// ── Helpers (tidak diubah) ─────────────────────────────────────
const categoryLabel: Record<string, string> = {
  kelas_praktikum: "Perkuliahan",
  event_kegiatan: "Event",
};

const getTimeString = (createdAt: string): string => {
  const d = new Date(createdAt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: any }> = {
    pending: { label: "Menunggu Kaprodi", variant: "outline" },
    approved_dosen: { label: "Menunggu Admin", variant: "secondary" },
    approved_admin: { label: "Disetujui", variant: "default" },
    picked_up: { label: "Dipinjam", variant: "default" },
    returned: { label: "Selesai", variant: "default" },
    rejected: { label: "Ditolak", variant: "destructive" },
    overdue: { label: "Terlambat", variant: "destructive" },
  };
  const c = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={c.variant}>{c.label}</Badge>;
};

// ✅ isLate tidak diubah
const isLate = (r: LoanRequest): boolean => {
  if (r.status === "overdue") return true;
  if (r.status === "returned" && r.returned_at && r.return_deadline) {
    return new Date(r.returned_at) > new Date(r.return_deadline);
  }
  if (
    ["picked_up", "approved_admin", "approved_dosen"].includes(r.status) &&
    r.return_deadline
  ) {
    return new Date(r.return_deadline) < new Date();
  }
  return false;
};

function Dashboard() {
  const { role } = useAuth();
  if (role === "admin") return <AdminDashboard />;
  return <UserDashboard />;
}

// ═══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
function AdminDashboard() {
  const [assetStats, setAssetStats] = useState({
    totalAsset: 0,
    stokMenipis: 0,
  });
  const [counts, setCounts] = useState({
    aktif: 0,
    selesai: 0,
    pendingAdmin: 0,
    dipinjam: 0,
    terlambat: 0,
    ditolak: 0,
  });
  // ✅ Simpan groups, bukan raw loans
  const [recentGroups, setRecentGroups] = useState<LoanGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [statsRes, loansRes] = await Promise.all([
        api.get("/api/assets/stats"),
        api.get("/api/loans"),
      ]);
      setAssetStats(statsRes.data?.data ?? { totalAsset: 0, stokMenipis: 0 });
      const all: LoanRequest[] = loansRes.data?.data ?? [];

      // KPI counts — tidak diubah, hitung dari individual loans
      setCounts({
        aktif: all.filter((l) =>
          [
            "pending",
            "approved_dosen",
            "approved_admin",
            "picked_up",
            "overdue",
          ].includes(l.status),
        ).length,
        selesai: all.filter((l) => l.status === "returned").length,
        pendingAdmin: all.filter((l) => l.status === "approved_dosen").length,
        dipinjam: all.filter((l) => l.status === "picked_up").length,
        terlambat: all.filter(isLate).length,
        ditolak: all.filter((l) => l.status === "rejected").length,
      });

      // ✅ Recent 24 jam → group sebelum masuk tabel
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = all
        .filter((l) => new Date(l.created_at) >= since24h)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      setRecentGroups(groupLoans(recent));
    } catch (err) {
      console.error("AdminDashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan status aset dan peminjaman lab."
      />

      {/* Row 1: Asset stats — tidak diubah */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Aset</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assetStats.totalAsset}</div>
            <p className="text-xs text-muted-foreground">
              Jumlah aset yang terdaftar
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stok Menipis</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {assetStats.stokMenipis}
            </div>
            <p className="text-xs text-muted-foreground">
              Aset dengan stok ≤ 1 unit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: 6 Loan cards — tidak diubah */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Peminjaman Aktif
            </CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {counts.aktif}
            </div>
            <p className="text-xs text-muted-foreground">Sedang berjalan</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Peminjaman Selesai
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {counts.selesai}
            </div>
            <p className="text-xs text-muted-foreground">Sudah dikembalikan</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approval Final
            </CardTitle>
            <Hourglass className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {counts.pendingAdmin}
            </div>
            <p className="text-xs text-muted-foreground">Menunggu admin</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Sedang Dipinjam
            </CardTitle>
            <PackageOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.dipinjam}</div>
            <p className="text-xs text-muted-foreground">
              Barang ada di peminjam
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Terlambat</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {counts.terlambat}
            </div>
            <p className="text-xs text-muted-foreground">Melewati deadline</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ditolak</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {counts.ditolak}
            </div>
            <p className="text-xs text-muted-foreground">Permintaan ditolak</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Peminjaman Terbaru — ✅ Grouped */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Peminjaman Terbaru</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  ⏰ Peminjaman yang dibuat dalam 24 jam terakhir
                </p>
              </div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Memuat data...
              </div>
            ) : recentGroups.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada peminjaman dalam 24 jam terakhir
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 px-2 text-left font-semibold">
                        Aset
                      </th>
                      <th className="py-2 px-2 text-left font-semibold">
                        Peminjam
                      </th>
                      <th className="py-2 px-2 text-left font-semibold">
                        Status
                      </th>
                      <th className="py-2 px-2 text-left font-semibold">
                        Kategori
                      </th>
                      <th className="py-2 px-2 text-left font-semibold">
                        Tgl Pinjam
                      </th>
                      <th className="py-2 px-2 text-left font-semibold">
                        Batas Waktu
                      </th>
                      <th className="py-2 px-2 text-center font-semibold">
                        Jam
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentGroups.map((group) => (
                      <tr
                        key={group.groupKey}
                        className="border-b transition hover:bg-muted/50"
                      >
                        {/* ✅ Aset: 1 baris jika single, list jika multi */}
                        <td className="py-2 px-2">
                          {group.items.length > 1 ? (
                            <ul className="space-y-0.5">
                              {group.items.map((item) => (
                                <li key={item.id} className="text-xs">
                                  • {item.asset_name} ×{item.quantity}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="font-medium">
                              {group.items[0].asset_name}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {group.requester_name}
                        </td>
                        <td className="py-2 px-2">
                          {getStatusBadge(group.status)}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">
                          {categoryLabel[group.category] ?? group.category}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">
                          {formatDate(group.borrow_date)}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">
                          {formatDate(group.return_deadline)}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-medium">
                          {getTimeString(group.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// USER DASHBOARD — tidak diubah selain grouping tabel
// ═══════════════════════════════════════════════════════════════
function UserDashboard() {
  const { profile, role } = useAuth();
  const [myLoans, setMyLoans] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/loans");
      setMyLoans(res.data?.data ?? []);
    } catch (err) {
      console.error("UserDashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Cards — tidak diubah
  const aktifCount = myLoans.filter((l) => l.status === "picked_up").length;
  const waitingCount = myLoans.filter((l) =>
    ["pending", "approved_dosen"].includes(l.status),
  ).length;
  const approvedCount = myLoans.filter(
    (l) => l.status === "approved_admin",
  ).length;

  // ✅ Recent 24 jam → group sebelum render tabel
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = myLoans
    .filter((l) => new Date(l.created_at) >= since24h)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  const recentGroups = groupLoans(recent);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Selamat datang, ${profile?.full_name ?? ""}! Berikut ringkasan peminjaman Anda.`}
      />

      {/* 3 Cards — tidak diubah */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pinjaman Aktif
            </CardTitle>
            <PackageOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aktifCount}</div>
            <p className="text-xs text-muted-foreground">
              Barang sedang dipinjam
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Menunggu Approval
            </CardTitle>
            <Hourglass className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {waitingCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {role === "student"
                ? "Menunggu kaprodi / admin"
                : "Menunggu persetujuan admin"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Sudah Disetujui
            </CardTitle>
            <PackageCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {approvedCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Siap diambil di admin lab
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Peminjaman Saya — ✅ Grouped & 24 jam */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Peminjaman Saya</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  ⏰ Peminjaman yang dibuat dalam 24 jam terakhir
                </p>
              </div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Memuat data...
              </div>
            ) : recentGroups.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada peminjaman dalam 24 jam terakhir.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 px-2 text-left font-semibold">
                        Aset
                      </th>
                      <th className="py-2 px-2 text-left font-semibold">
                        Status
                      </th>
                      <th className="py-2 px-2 text-left font-semibold">
                        Kategori
                      </th>
                      <th className="py-2 px-2 text-left font-semibold">
                        Tgl Pinjam
                      </th>
                      <th className="py-2 px-2 text-left font-semibold">
                        Batas Waktu
                      </th>
                      <th className="py-2 px-2 text-center font-semibold">
                        Jam
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentGroups.map((group) => (
                      <tr
                        key={group.groupKey}
                        className="border-b transition hover:bg-muted/50"
                      >
                        <td className="py-2 px-2">
                          {group.items.length > 1 ? (
                            <ul className="space-y-0.5">
                              {group.items.map((item) => (
                                <li key={item.id} className="text-xs">
                                  • {item.asset_name} ×{item.quantity}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="font-medium">
                              {group.items[0].asset_name}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {getStatusBadge(group.status)}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">
                          {categoryLabel[group.category] ?? group.category}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">
                          {formatDate(group.borrow_date)}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">
                          {formatDate(group.return_deadline)}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-medium">
                          {getTimeString(group.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
