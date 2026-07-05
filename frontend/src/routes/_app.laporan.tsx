import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { KpiCard } from "../components/common/KpiCard";
import { Pagination } from "../components/common/Pagination";
import {
  ClipboardList,
  AlertTriangle,
  CheckSquare,
  PackageX,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { StatusBadge, type LoanStatus } from "../components/common/StatusBadge";
import { getLoans, getAllLoansForReport } from "../services/loan.service";

export const Route = createFileRoute("/_app/laporan")({
  component: Laporan,
  head: () => ({ meta: [{ title: "Laporan Peminjaman · MNP Lab Loan" }] }),
});

interface Asset {
  id: string;
  name: string;
  merk?: string;
  type?: string;
  quantity: number;
}

interface Row {
  id: string;
  loan_number?: string;
  status: string;
  notes: string;
  asset_name: string;
  borrow_date: string;
  return_deadline: string;
  returned_at?: string | null;
  category: string;
  requester_name?: string;
  nim_nip?: string | null;
  assets?: Asset[];
  asset_count?: number;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

const isLate = (r: Row): boolean => {
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

  const LIMIT = 10;
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: LIMIT,
    totalPages: 0,
  });

  const load = async (currentPage = page) => {
    if (!role || (role !== "admin" && role !== "dosen")) return;

    try {
      setFetching(true);

      let res;
      if (role === "admin") {
        res = await getAllLoansForReport({ page: currentPage, limit: LIMIT });
      } else {
        res = await getLoans({ page: currentPage, limit: LIMIT });
      }

      const data: Row[] = (res.data?.data ?? []).map((r: any) => ({
        id: r.id,
        loan_number: r.loan_number ?? null,
        status: r.status,
        notes: r.notes ?? "—",
        asset_name: r.asset_name ?? "—",
        borrow_date: r.borrow_date,
        return_deadline: r.return_deadline,
        returned_at: r.returned_at ?? null,
        category: r.category ?? "",
        requester_name: r.requester_name ?? "—",
        nim_nip: r.nim_nip ?? null,
        assets: Array.isArray(r.assets) ? r.assets : [],
        asset_count: r.asset_count ?? 1,
      }));

      setRows(data);

      const paginationData = res.data?.pagination ?? {
        total: 0,
        page: 1,
        limit: LIMIT,
        totalPages: 0,
      };
      setPagination(paginationData);
      setPage(currentPage);

      setStats({
        total: paginationData.total,
        selesai: data.filter((r) => r.status === "returned").length,
        terlambat: data.filter((r) => isLate(r)).length,
        ditolak: data.filter((r) => r.status === "rejected").length,
      });
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    void load(page);
  }, [role, loading, page]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

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

      <div className="mt-8 overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">ID</th>
              {(role === "admin" || role === "dosen") && (
                <>
                  <th className="px-4 py-3">Peminjam</th>
                  <th className="px-4 py-3">NIM/NIP</th>
                </>
              )}
              <th className="px-4 py-3">Aset</th>
              <th className="px-4 py-3">Qty</th>
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
                  colSpan={role === "admin" || role === "dosen" ? 9 : 7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Memuat…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={role === "admin" || role === "dosen" ? 9 : 7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Belum ada data.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.loan_number ?? r.id.slice(0, 8)}
                  </td>
                  {(role === "admin" || role === "dosen") && (
                    <>
                      <td className="px-4 py-3 font-medium">
                        {r.requester_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.nim_nip ?? "—"}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    {r.assets && r.assets.length > 1 ? (
                      <ul className="list-inside list-disc space-y-0.5">
                        {r.assets.map((asset) => (
                          <li key={asset.id}>
                            {asset.name}
                            {asset.quantity > 1 ? ` (${asset.quantity})` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="font-medium">{r.asset_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      {r.asset_count ?? 1} aset
                    </span>
                  </td>
                  <td className="px-4 py-3">{getCategoryLabel(r.category)}</td>
                  <td className="px-4 py-3">{formatDate(r.borrow_date)}</td>
                  <td className="px-4 py-3">
                    {formatDate(r.return_deadline)}
                    {isLate(r) && r.status === "returned" && (
                      <span className="ml-1 text-xs text-destructive">⚠️</span>
                    )}
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

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        limit={pagination.limit}
        onPageChange={handlePageChange}
        loading={fetching}
      />
    </>
  );
}
