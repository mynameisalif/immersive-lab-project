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
import { getLoans } from "../services/loan.service";
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
}

// ── Loan Group ────────────────────────────────────────────────
interface LoanGroup {
  groupKey: string;
  requester_id: string;
  requester_name: string;
  status: string;
  statusMapped: LoanStatus;
  borrow_date: string;
  return_deadline: string;
  category: string;
  created_at: string;
  items: Loan[];
}

// ✅ Grouping 10 detik
const GROUP_WINDOW_MS = 10_000;

function groupLoans(loans: Loan[]): LoanGroup[] {
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
        requester_name: item.requester_name ?? "—",
        status: item.status,
        statusMapped: item.statusMapped,
        borrow_date: item.borrow_date,
        return_deadline: item.return_deadline,
        category: item.category,
        created_at: item.created_at,
        items: [item],
      });
    }
  }
  return groups;
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
      // ✅ FIX 1: tambah /api prefix + pagination params
      const res = await api.get(
        `/api/loans?page=${currentPage}&limit=${LIMIT}`,
      );

      // ✅ FIX 2: map dulu ke Loan[], BARU set ke state
      const data: Loan[] = (res.data?.data ?? []).map((r: any) => ({
        id: r.id,
        notes: r.notes ?? "",
        status: r.status,
        statusMapped: mapStatus(r.status), // ← penting! tanpa ini badge tidak muncul
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
      }));

      // ✅ FIX 3: HAPUS filter client-side!
      // Backend sudah handle semua filtering berdasarkan role
      // Jadi langsung set rows tanpa filter
      setRows(data);

      // ✅ FIX 4: ambil pagination dari response
      setTotalPages(res.data.pagination?.totalPages ?? 1);
      setTotal(res.data.pagination?.total ?? 0);
      setPage(currentPage); // ← tambahkan ini supaya state page sync
    } catch {
      setRows([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX 5: useEffect tetap sama
  useEffect(() => {
    void load(page);
  }, [user, role, page]);

  // ✅ Handler ganti halaman
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // ✅ Handler ganti tab - reset ke halaman 1
  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    setPage(1); // ← penting! ganti tab = kembali ke halaman 1
  };

  if (isChildRoute) return <Outlet />;

  // ✅ Group dulu, baru filter berdasarkan tab
  const allGroups = groupLoans(rows);

  const filteredGroups = allGroups.filter((g) => {
    if (tab === "all") return true;
    if (tab === "menunggu") return isMenunggu(g.status);
    if (tab === "aktif") return isAktif(g.status);
    if (tab === "selesai") return isSelesai(g.status);
    return true;
  });

  const showPeminjam = role === "admin";
  // ✅ Kolom Qty dihapus, digabung di kolom Aset → colCount -1
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

      {/* Form request untuk non-admin — tidak diubah */}
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

      {/* Tabel — ✅ Grouped */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-base font-semibold">{heading}</h2>
        <Tabs value={tab} onValueChange={setTab}>
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
                    {/* ✅ Kolom Aset mencakup qty (Qty dihapus sebagai kolom terpisah) */}
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
                  ) : filteredGroups.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colCount}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        Belum ada data.
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((group) => (
                      <tr key={group.groupKey} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">
                          {group.groupKey.slice(0, 8)}
                        </td>
                        {showPeminjam && (
                          <td className="px-4 py-3">{group.requester_name}</td>
                        )}
                        {/* ✅ Aset: 1 baris jika single, list jika multi */}
                        <td className="px-4 py-3">
                          {group.items.length > 1 ? (
                            <ul className="space-y-0.5">
                              {group.items.map((item) => (
                                <li key={item.id} className="text-xs">
                                  • {getMerkLabel(item)} ×{item.quantity}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span>
                              {getMerkLabel(group.items[0])}
                              <span className="text-muted-foreground">
                                {" "}
                                ×{group.items[0].quantity}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getCategoryLabel(group.category)}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(group.borrow_date)}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(group.return_deadline)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={group.statusMapped} />
                        </td>
                      </tr>
                    ))
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
