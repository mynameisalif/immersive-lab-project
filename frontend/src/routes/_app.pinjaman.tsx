import {
  createFileRoute,
  Link,
  Outlet,
  useMatches,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { StatusBadge, type LoanStatus } from "../components/common/StatusBadge";
import { useAuth } from "../lib/auth";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { LoanRequestForm } from "../components/loan/LoanRequestForm";
import api from "@/lib/api";
import { Pagination } from "../components/common/Pagination";

export const Route = createFileRoute("/_app/pinjaman")({
  component: Pinjaman,
  head: () => ({ meta: [{ title: "Peminjaman · MNP Lab Loan" }] }),
});

interface Asset {
  id: string;
  name: string;
  merk?: string;
  type?: string;
  quantity: number;
}

// ✅ Backend sekarang sudah mengirim 1 baris PER UNIK PEMINJAMAN
//    (bukan per-aset lagi), lengkap dengan array `assets`.
interface Loan {
  id: string;
  notes: string;
  status: string;
  statusMapped: LoanStatus;
  borrow_date: string;
  return_deadline: string;
  category: string;
  created_at: string;
  requester_id: string;
  requester_name?: string;
  asset_name?: string;
  merk?: string;
  type?: string;
  quantity: number;
  assets?: Asset[];
  asset_count?: number;
}

// ── Helpers — tidak diubah ─────────────────────────────────────
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
  return (map[s] ?? "pending_dosen") as LoanStatus;
};

const isMenunggu = (s: string) => s === "pending" || s === "approved_dosen";
const isAktif = (s: string) => s === "approved_admin" || s === "picked_up";
const isSelesai = (s: string) =>
  s === "returned" || s === "rejected" || s === "overdue";

function Pinjaman() {
  const matches = useMatches();
  const { user, role } = useAuth();
  const [rows, setRows] = useState<Loan[]>([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(false);

  const isChildRoute = matches.some((m) => m.routeId === "/_app/pinjaman/baru");

  const LIMIT = 10;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (currentPage = page) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get(
        `/api/loans?page=${currentPage}&limit=${LIMIT}`,
      );

      // ✅ Setiap row dari backend = 1 unik peminjaman (sudah digrouping
      //    di backend), lengkap dengan array `assets` untuk semua aset
      //    dalam peminjaman itu.
      const data: Loan[] = (res.data?.data ?? []).map((r: any) => ({
        id: r.id,
        notes: r.notes ?? "",
        status: r.status,
        statusMapped: mapStatus(r.status),
        borrow_date: r.borrow_date,
        return_deadline: r.return_deadline,
        category: r.category,
        created_at: r.created_at,
        requester_id: r.requester_id,
        requester_name: r.requester_name ?? "—",
        asset_name: r.asset_name ?? "—",
        merk: r.merk ?? "",
        type: r.type ?? "",
        quantity: r.quantity ?? 0,
        assets: Array.isArray(r.assets) ? r.assets : [],
        asset_count: r.asset_count ?? 1,
      }));

      setRows(data);
      setTotalPages(res.data.pagination?.totalPages ?? 1);
      setTotal(res.data.pagination?.total ?? 0);
      setPage(currentPage);
    } catch {
      setRows([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(page);
  }, [user, role, page]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    setPage(1);
  };

  if (isChildRoute) return <Outlet />;

  // ✅ Tidak perlu groupLoans lagi — backend sudah mengirim 1 baris
  //    per unik peminjaman. Filter langsung di atas `rows`.
  const filteredRows = rows.filter((r) => {
    if (tab === "all") return true;
    if (tab === "menunggu") return isMenunggu(r.status);
    if (tab === "aktif") return isAktif(r.status);
    if (tab === "selesai") return isSelesai(r.status);
    return true;
  });

  const showPeminjam = role === "admin";
  const colCount = showPeminjam ? 7 : 6;

  const heading =
    role === "admin" ? "Daftar Peminjaman" : "Daftar Peminjaman Saya";
  const desc =
    role === "admin"
      ? "Semua data peminjaman aset lab."
      : "Ajukan & lihat riwayat peminjaman Anda.";

  const isRequester = role !== "admin";

  const getMerkLabel = (row: Loan) => {
    const parts = [row.merk, row.type].filter(Boolean).join(" ");
    return parts || row.asset_name || "—";
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

  return (
    <>
      <PageHeader
        title="Peminjaman"
        description={desc}
        actions={
          role !== "admin" ? null : (
            <Button asChild variant="brand">
              <Link to="/pinjaman/baru">
                <Plus className="size-4" /> Tambah
              </Link>
            </Button>
          )
        }
      />

      {isRequester && (
        <section className="mt-6 rounded-xl border bg-card p-5 shadow-(--shadow-card)">
          <h2 className="font-display text-base font-semibold">
            Pengajuan Peminjaman
          </h2>
          <p className="text-sm text-muted-foreground">
            Lengkapi formulir untuk mengajukan peminjaman aset lab.
          </p>
          <div className="mt-4">
            <LoanRequestForm onCreated={load} />
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-base font-semibold">{heading}</h2>
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">Semua</TabsTrigger>
            <TabsTrigger value="menunggu">Menunggu</TabsTrigger>
            <TabsTrigger value="aktif">Aktif</TabsTrigger>
            <TabsTrigger value="selesai">Selesai</TabsTrigger>
          </TabsList>

          <TabsContent value={tab}>
            <div className="mt-3 overflow-x-auto rounded-xl border bg-card shadow-(--shadow-card)">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    {showPeminjam && <th className="px-4 py-3">Peminjam</th>}
                    <th className="px-4 py-3">Aset</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Tgl Pinjam</th>
                    <th className="px-4 py-3">Tgl Kembali</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={colCount}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        Memuat data…
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colCount}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        Belum ada data.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const hasMultiAsset = row.assets && row.assets.length > 1;
                      return (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs">
                            {row.id.slice(0, 8)}
                          </td>
                          {showPeminjam && (
                            <td className="px-4 py-3">{row.requester_name}</td>
                          )}
                          {/* ✅ Aset: list semua item jika multi-asset */}
                          <td className="px-4 py-3">
                            {hasMultiAsset ? (
                              <ul className="space-y-0.5">
                                {row.assets!.map((asset) => (
                                  <li key={asset.id} className="text-xs">
                                    •{" "}
                                    {[asset.name, asset.merk, asset.type]
                                      .filter(Boolean)
                                      .join(" ")}{" "}
                                    ×{asset.quantity}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span>
                                {getMerkLabel(row)}
                                <span className="text-muted-foreground">
                                  {" "}
                                  ×{row.quantity}
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {getCategoryLabel(row.category)}
                          </td>
                          <td className="px-4 py-3">
                            {formatDate(row.borrow_date)}
                          </td>
                          <td className="px-4 py-3">
                            {formatDate(row.return_deadline)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={row.statusMapped} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={LIMIT}
                onPageChange={handlePageChange}
                loading={loading}
              />
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}
