import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import {
  CheckCircle2,
  Package,
  User,
  Calendar,
  Search,
  Loader2,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { Pagination } from "../components/common/Pagination";
import api from "../lib/api";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { getApprovedForPickup } from "@/services/loan.service";

export const Route = createFileRoute("/_app/pengambilan")({
  component: PengambilanPage,
  head: () => ({ meta: [{ title: "Konfirmasi Pengambilan · MNP Lab Loan" }] }),
});

// ── Types ─────────────────────────────────────────────────────
// ✅ Asset item dalam batch — punya loan_id untuk API call per-aset
interface AssetItem {
  loan_id: string;
  asset_id: string;
  name: string;
  merk: string | null;
  type: string | null;
  quantity: number;
}

// ✅ Row = 1 baris per BATCH (sudah digrouping backend)
interface LoanRow {
  id: string;
  loan_number: string | null;
  requester_name: string;
  nim_nip: string | null;
  requester_role: string;
  requester_id: string;
  borrow_date: string;
  return_deadline: string;
  category: string;
  notes: string | null;
  created_at: string;
  assets: AssetItem[];
  asset_count: number;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Helpers ───────────────────────────────────────────────────
const roleLabel: Record<string, string> = {
  student: "Mahasiswa",
  dosen: "Dosen",
  staff: "Staff",
  admin: "Admin",
};

const categoryLabel: Record<string, string> = {
  kelas_praktikum: "Perkuliahan / Praktikum",
  event_kegiatan: "Event / Kegiatan",
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const getAssetLabel = (a: AssetItem) => {
  const parts = [a.merk, a.type].filter(Boolean).join(" ");
  return parts || a.name;
};

// ── Component ─────────────────────────────────────────────────
function PengambilanPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<LoanRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const LIMIT = 10;
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: LIMIT,
    totalPages: 0,
  });

  useEffect(() => {
    if (role && role !== "admin") navigate({ to: "/dashboard" });
  }, [role]);

  // ✅ Load — backend sudah kirim 1 baris per batch, tidak perlu groupLoans manual
  const loadLoans = async (currentPage = page) => {
    try {
      setLoading(true);
      const res = await getApprovedForPickup({
        page: currentPage,
        limit: LIMIT,
      });
      const data = res.data?.data ?? [];

      const mapped: LoanRow[] = data.map((r: any) => ({
        id: r.id,
        loan_number: r.loan_number ?? null,
        requester_name: r.requester_name ?? "—",
        nim_nip: r.nim_nip ?? null,
        requester_role: r.requester_role ?? "",
        requester_id: r.requester_id,
        borrow_date: r.borrow_date,
        return_deadline: r.return_deadline,
        category: r.category ?? "",
        notes: r.notes ?? null,
        created_at: r.created_at,
        assets: Array.isArray(r.assets) ? r.assets : [],
        asset_count: r.asset_count ?? 1,
      }));

      setRows(mapped);
      setPagination(
        res.data?.pagination ?? {
          total: 0,
          page: 1,
          limit: LIMIT,
          totalPages: 0,
        },
      );
      setPage(currentPage);
    } catch {
      toast.error("Gagal memuat data peminjaman");
      setRows([]);
      setPagination({ total: 0, page: 1, limit: LIMIT, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLoans(page);
  }, [page]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const openConfirm = (row: LoanRow) => {
    setSelectedRow(row);
    setDialogOpen(true);
  };

  // ✅ Konfirmasi semua asset (per loan_id) dalam batch
  const handleConfirmBatch = async () => {
    if (!selectedRow) return;
    try {
      setConfirming(true);
      let successCount = 0;

      for (const asset of selectedRow.assets) {
        try {
          await api.patch(`/api/loans/${asset.loan_id}/pickup`);
          successCount++;
        } catch (err: any) {
          toast.error(
            `Gagal konfirmasi ${getAssetLabel(asset)}: ${err.response?.data?.message ?? "Error"}`,
          );
        }
      }

      if (successCount > 0) {
        toast.success(
          selectedRow.assets.length > 1
            ? `${successCount} aset berhasil dikonfirmasi pengambilannya!`
            : `Pengambilan "${getAssetLabel(selectedRow.assets[0])}" berhasil dikonfirmasi!`,
        );
        setDialogOpen(false);
        setSelectedRow(null);
        await loadLoans(page);
      }
    } finally {
      setConfirming(false);
    }
  };

  // Filter by search (client-side, di halaman berjalan)
  const filtered = rows.filter((row) => {
    const q = search.toLowerCase();
    return (
      !q ||
      row.requester_name.toLowerCase().includes(q) ||
      (row.loan_number ?? "").toLowerCase().includes(q) ||
      row.assets.some(
        (a) =>
          getAssetLabel(a).toLowerCase().includes(q) ||
          (row.nim_nip ?? "").includes(q),
      )
    );
  });

  return (
    <>
      <PageHeader
        title="Konfirmasi Pengambilan"
        description="Konfirmasi pengambilan barang setelah ID Card peminjam diverifikasi."
      />

      {/* Info banner */}
      <div className="mt-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <p>
          Sebelum mengkonfirmasi, pastikan ID Card peminjam sudah diverifikasi
          secara fisik. Cocokkan <strong>Nama</strong> dan{" "}
          <strong>NIM/NIP</strong> dengan data yang tampil.
        </p>
      </div>

      {/* Search */}
      <div className="relative mt-5 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, aset, NIM/NIP, ID…"
          className="pl-9"
        />
      </div>

      {!loading && rows.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {filtered.length} pengajuan menunggu konfirmasi pengambilan
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm">Memuat data...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={CheckCircle2}
            title={
              rows.length === 0
                ? "Tidak ada pengambilan pending"
                : "Tidak ada hasil"
            }
            description={
              rows.length === 0
                ? "Belum ada peminjaman yang menunggu konfirmasi pengambilan."
                : "Coba kata kunci lain."
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {filtered.map((row) => {
              const isMulti = row.assets.length > 1;
              return (
                <div
                  key={row.id}
                  className="rounded-xl border bg-card p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* ✅ ID/Nomor peminjaman */}
                      {row.loan_number && (
                        <p className="font-mono text-xs text-muted-foreground">
                          {row.loan_number}
                        </p>
                      )}

                      {/* Aset */}
                      {isMulti ? (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Package className="size-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">
                              {row.assets.length} aset dalam satu pengajuan:
                            </span>
                          </div>
                          <ul className="ml-5 space-y-0.5">
                            {row.assets.map((asset) => (
                              <li
                                key={asset.loan_id}
                                className="font-semibold text-sm"
                              >
                                • {getAssetLabel(asset)} × {asset.quantity} unit
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Package className="size-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">
                              {getAssetLabel(row.assets[0])}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.assets[0].quantity} unit
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Peminjam */}
                      <div className="flex items-start gap-2">
                        <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">
                            {row.requester_name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {row.nim_nip ?? "NIM/NIP belum diisi"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {roleLabel[row.requester_role] ??
                              row.requester_role}
                          </p>
                        </div>
                      </div>

                      {/* Tanggal & Kategori */}
                      <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-sm">
                            {formatDate(row.borrow_date)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Kembali: {formatDate(row.return_deadline)} ·{" "}
                            {categoryLabel[row.category] ?? row.category}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Tombol */}
                    <div className="shrink-0 self-center">
                      <Button onClick={() => openConfirm(row)}>
                        <CheckCircle2 className="mr-2 size-4" />
                        Konfirmasi
                        {isMulti ? ` (${row.assets.length} Aset)` : ""}
                      </Button>
                    </div>
                  </div>

                  {row.notes && (
                    <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      📝 {row.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={handlePageChange}
            loading={loading}
          />
        </>
      )}

      {/* ── Dialog konfirmasi ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Konfirmasi Pengambilan Barang
            </DialogTitle>
            <DialogDescription>
              Pastikan verifikasi ID Card sudah dilakukan sebelum konfirmasi.
            </DialogDescription>
          </DialogHeader>

          {selectedRow && (
            <div className="space-y-4 py-1">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
                {selectedRow.loan_number && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {selectedRow.loan_number}
                  </p>
                )}

                {selectedRow.assets.length > 1 ? (
                  <div className="flex gap-3 items-start">
                    <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">
                        {selectedRow.assets.length} Aset:
                      </p>
                      <ul className="mt-0.5 space-y-0.5">
                        {selectedRow.assets.map((a) => (
                          <li
                            key={a.loan_id}
                            className="text-xs text-muted-foreground"
                          >
                            • {getAssetLabel(a)} × {a.quantity} unit
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 items-start">
                    <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">
                        {getAssetLabel(selectedRow.assets[0])}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedRow.assets[0].quantity} unit
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 items-start">
                  <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">
                      {selectedRow.requester_name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      NIM/NIP: {selectedRow.nim_nip ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p>
                    {formatDate(selectedRow.borrow_date)} s.d.{" "}
                    {formatDate(selectedRow.return_deadline)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <ClipboardList className="size-4" />
                  Checklist verifikasi:
                </p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {[
                    "ID Card sudah diperiksa secara fisik",
                    "Nama di ID Card cocok dengan sistem",
                    "NIM/NIP di ID Card cocok dengan sistem",
                    "Semua barang sudah disiapkan untuk diserahkan",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={confirming}
            >
              Batal
            </Button>
            <Button onClick={handleConfirmBatch} disabled={confirming}>
              {confirming ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Mengkonfirmasi...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-4" /> Ya, Konfirmasi
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
