import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { KpiCard } from "../components/common/KpiCard";
import {
  ClipboardList,
  AlertTriangle,
  CheckSquare,
  PackageX,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { StatusBadge, type LoanStatus } from "../components/common/StatusBadge";
import { getLoans } from "../services/loan.service";

export const Route = createFileRoute("/_app/laporan")({
  component: Laporan,
  head: () => ({ meta: [{ title: "Laporan Peminjaman · MNP Lab Loan" }] }),
});

interface Row {
  id: string;
  status: string;
  notes: string;
  asset_name: string;
  borrow_date: string;
  return_deadline: string;
  returned_at?: string | null;
  category: string;
}

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

const formatDate = (d: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
};

const getCategoryLabel = (cat: string) => {
  if (cat === "kelas_praktikum") return "Kelas / Praktikum";
  if (cat === "event_kegiatan") return "Event / Kegiatan";
  return cat;
};

// ✅ Cek apakah peminjaman terlambat:
// 1. Status masih overdue (belum dikembalikan)
// 2. Sudah returned tapi returned_at > return_deadline
const isLate = (r: Row): boolean => {
  if (r.status === "overdue") return true;
  if (r.status === "returned" && r.returned_at && r.return_deadline) {
    return new Date(r.returned_at) > new Date(r.return_deadline);
  }
  // Aktif dan sudah lewat deadline
  if (
    ["picked_up", "approved_admin", "approved_dosen"].includes(r.status) &&
    r.return_deadline
  ) {
    return new Date(r.return_deadline) < new Date();
  }
  return false;
};

function Laporan() {
  const { role, loading } = useAuth();

  const [stats, setStats] = useState({
    total: 0,
    selesai: 0,
    terlambat: 0,
    ditolak: 0,
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && role && role !== "admin" && role !== "dosen") return;
    if (!role || (role !== "admin" && role !== "dosen")) return;

    void (async () => {
      try {
        setFetching(true);
        const res = await getLoans();
        const data: Row[] = (res.data?.data ?? []).map((r: any) => ({
          id: r.id,
          status: r.status,
          notes: r.notes ?? "—",
          asset_name: r.asset_name ?? "—",
          borrow_date: r.borrow_date,

          return_deadline: r.return_deadline,
          returned_at: r.returned_at ?? null, // ← tambah ini
          category: r.category ?? "",
        }));

        setRows(data);

        setStats({
          total: data.length,
          selesai: data.filter((r) => r.status === "returned").length,
          // ✅ Hitung terlambat dari tanggal, bukan hanya status overdue
          terlambat: data.filter((r) => isLate(r)).length,
          ditolak: data.filter((r) => r.status === "rejected").length,
        });
      } catch {
        setRows([]);
      } finally {
        setFetching(false);
      }
    })();
  }, [role, loading]);

  if (!loading && role && role !== "admin" && role !== "dosen") {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Halaman ini tidak tersedia.
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Laporan Peminjaman"
        description={
          role === "dosen"
            ? "Statistik peminjaman mahasiswa bimbingan Anda."
            : "Statistik dan riwayat seluruh peminjaman."
        }
      />

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Peminjaman"
          value={stats.total}
          icon={ClipboardList}
          tone="primary"
        />
        <KpiCard
          label="Selesai"
          value={stats.selesai}
          icon={CheckSquare}
          tone="success"
        />
        <KpiCard
          label="Terlambat"
          value={stats.terlambat}
          icon={AlertTriangle}
          tone="destructive"
        />
        <KpiCard
          label="Ditolak"
          value={stats.ditolak}
          icon={PackageX}
          tone="warning"
        />
      </div>

      {/* Tabel */}
      <div className="mt-8 overflow-x-auto rounded-xl border bg-card shadow-(--shadow-card)">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Aset</th>
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Pinjam</th>
              <th className="px-4 py-3">Kembali</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {fetching ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Memuat data…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Belum ada data.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.asset_name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.notes}
                  </td>
                  <td className="px-4 py-3">{getCategoryLabel(r.category)}</td>
                  <td className="px-4 py-3">{formatDate(r.borrow_date)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        isLate(r) ? "text-destructive font-medium" : ""
                      }
                    >
                      {formatDate(r.return_deadline)}
                      {isLate(r) && r.status === "returned" && (
                        <span className="ml-1 text-[10px]">⚠️ Terlambat</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={mapStatus(r.status)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
