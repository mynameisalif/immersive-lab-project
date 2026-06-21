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

export const Route = createFileRoute("/_app/pinjaman")({
  component: Pinjaman,
  head: () => ({ meta: [{ title: "Peminjaman · MNP Lab Loan" }] }),
});

interface Loan {
  id: string;
  notes: string;
  status: string; // ← string (raw dari backend)
  statusMapped: LoanStatus; // ← LoanStatus (setelah di-map)
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

// Map status backend → LoanStatus untuk StatusBadge
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

// Filter berdasarkan status raw dari backend
const isMenunggu = (s: string) => s === "pending" || s === "approved_dosen";
const isAktif = (s: string) => s === "approved_admin" || s === "picked_up";
const isSelesai = (s: string) =>
  s === "returned" || s === "rejected" || s === "overdue";

function Pinjaman() {
  const matches = useMatches();
  const { user, role, isKaprodi } = useAuth();
  const [rows, setRows] = useState<Loan[]>([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(false);

  const isChildRoute = matches.some((m) => m.routeId === "/_app/pinjaman/baru");

  const load = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await getLoans();
      const data: Loan[] = (res.data?.data ?? []).map((r: any) => ({
        id: r.id,
        notes: r.notes ?? "",
        status: r.status, // raw string
        statusMapped: mapStatus(r.status), // ✅ mapped untuk badge
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
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user, role]);

  if (isChildRoute) return <Outlet />;

  const filtered = rows.filter((r) => {
    if (tab === "all") return true;
    if (tab === "menunggu") return isMenunggu(r.status);
    if (tab === "aktif") return isAktif(r.status);
    if (tab === "selesai") return isSelesai(r.status);
    return true;
  });

  const showPeminjam = role === "admin" || role === "dosen";
  const colCount = showPeminjam ? 8 : 7;

  const heading =
    role === "admin"
      ? "Daftar Peminjaman"
      : role === "dosen"
        ? "Daftar Peminjaman (Bimbingan Saya)"
        : "Daftar Peminjaman Saya";

  const desc =
    role === "admin"
      ? "Semua data peminjaman aset lab."
      : role === "dosen"
        ? "Peminjaman dari mahasiswa yang memilih Anda sebagai dosen pembimbing."
        : "Ajukan & lihat riwayat peminjaman Anda.";

  // ✅ FIXED: Allow all non-admin roles (student, staff, dosen, kaprodi) to create requests
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

      {/* Form request — untuk student, staff, dosen, dan kaprodi */}
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

      {/* Tabel */}
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
                    <th className="px-4 py-3">Aset</th>
                    <th className="px-4 py-3">Qty</th>
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
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colCount}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        Belum ada data.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">
                          {r.id.slice(0, 8)}
                        </td>
                        {showPeminjam && (
                          <td className="px-4 py-3">{r.requester_name}</td>
                        )}
                        <td className="px-4 py-3">{getMerkLabel(r)}</td>
                        <td className="px-4 py-3">{r.quantity}</td>
                        <td className="px-4 py-3">
                          {getCategoryLabel(r.category)}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(r.borrow_date)}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(r.return_deadline)}
                        </td>
                        <td className="px-4 py-3">
                          {/* ✅ Pakai statusMapped bukan status langsung */}
                          <StatusBadge status={r.statusMapped} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}
