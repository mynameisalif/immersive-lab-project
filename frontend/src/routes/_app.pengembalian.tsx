import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge, type LoanStatus } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeftRight, CheckCircle, Loader2, Package } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Pagination } from "@/components/common/Pagination";
import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getReturnPending } from "@/services/loan.service";

export const Route = createFileRoute("/_app/pengembalian")({
  component: Pengembalian,
  head: () => ({ meta: [{ title: "Pengembalian · MNP Lab Loan" }] }),
});

// ── Types ─────────────────────────────────────────────────────
// ✅ Asset item dalam satu batch — sekarang punya loan_id (untuk API call)
interface AssetItem {
  loan_id: string;
  asset_id: string;
  name: string;
  merk: string | null;
  type: string | null;
  quantity: number;
}

// ✅ Row = 1 baris per BATCH (sudah digrouping backend via DISTINCT ON + LATERAL)
interface Row {
  id: string;
  loan_number: string | null;
  status: string;
  notes: string;
  borrow_date: string;
  return_deadline: string;
  returned_at?: string | null;
  requester_name: string;
  requester_id: string;
  nim_nip: string | null;
  category: string;
  created_at: string;
  assets: AssetItem[];
  asset_count: number;
}

interface UnitDetail {
  id: string;
  unit_code: string;
  condition: string;
  loan_status: string;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Helpers ───────────────────────────────────────────────────
const mapStatus = (s: string): LoanStatus => {
  const map: Record<string, LoanStatus> = {
    picked_up: "picked_up",
    returned: "returned",
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

const getAssetLabel = (a: AssetItem) => {
  const parts = [a.merk, a.type].filter(Boolean).join(" ");
  return parts || a.name;
};

const isOverdue = (deadline: string) => new Date(deadline) < new Date();

// ── Component ─────────────────────────────────────────────────
function Pengembalian() {
  const { user, role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const LIMIT = 10;
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: LIMIT,
    totalPages: 0,
  });

  // Dialog state
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [assetUnits, setAssetUnits] = useState<Record<string, UnitDetail[]>>(
    {},
  ); // key = loan_id
  const [unitConditions, setUnitConditions] = useState<Record<string, string>>(
    {},
  );
  const [returnNotes, setReturnNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);

  // ✅ Load — backend sudah kirim 1 baris per batch, tidak perlu grouping manual lagi
  const load = async (currentPage = page) => {
    try {
      setLoading(true);

      let mapped: Row[] = [];

      if (role === "admin") {
        const res = await getReturnPending({ page: currentPage, limit: LIMIT });
        const data = res.data?.data ?? [];
        mapped = data.map((r: any) => ({
          id: r.id,
          loan_number: r.loan_number ?? null,
          status: r.status,
          notes: r.notes ?? "—",
          borrow_date: r.borrow_date,
          return_deadline: r.return_deadline,
          returned_at: r.returned_at ?? null,
          requester_name: r.requester_name ?? "—",
          requester_id: r.requester_id,
          nim_nip: r.nim_nip ?? null,
          category: r.category ?? "",
          created_at: r.created_at,
          assets: Array.isArray(r.assets) ? r.assets : [],
          asset_count: r.asset_count ?? 1,
        }));

        setPagination(
          res.data?.pagination ?? {
            total: 0,
            page: 1,
            limit: LIMIT,
            totalPages: 0,
          },
        );
        setPage(currentPage);
      } else {
        // Student/dosen non-kaprodi: getLoans biasa (belum ada endpoint grouped khusus)
        const res = await api.get("/api/loans");
        const data = res.data?.data ?? [];
        let filtered = data.filter((r: any) =>
          ["picked_up", "overdue"].includes(r.status),
        );
        if (role === "student") {
          filtered = filtered.filter((r: any) => r.requester_id === user?.id);
        }
        // Fallback: setiap row jadi 1 "batch" berisi 1 asset (belum ada grouping backend untuk non-admin)
        mapped = filtered.map((r: any) => ({
          id: r.id,
          loan_number: r.loan_number ?? null,
          status: r.status,
          notes: r.notes ?? "—",
          borrow_date: r.borrow_date,
          return_deadline: r.return_deadline,
          returned_at: r.returned_at ?? null,
          requester_name: r.requester_name ?? "—",
          requester_id: r.requester_id,
          nim_nip: r.nim_nip ?? null,
          category: r.category ?? "",
          created_at: r.created_at,
          assets: [
            {
              loan_id: r.id,
              asset_id: r.asset_id,
              name: r.asset_name ?? "—",
              merk: r.merk ?? null,
              type: r.type ?? null,
              quantity: r.quantity ?? 1,
            },
          ],
          asset_count: 1,
        }));
        setPagination({
          total: mapped.length,
          page: 1,
          limit: LIMIT,
          totalPages: 1,
        });
      }

      mapped.sort(
        (a, b) =>
          new Date(a.return_deadline).getTime() -
          new Date(b.return_deadline).getTime(),
      );

      setRows(mapped);
    } catch {
      setRows([]);
      setPagination({ total: 0, page: 1, limit: LIMIT, totalPages: 0 });
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

  // ✅ Buka dialog — fetch units per loan_id dari assets[]
  const openRowDialog = async (row: Row) => {
    setSelectedRow(row);
    setReturnNotes("");
    setUnitConditions({});
    setAssetUnits({});
    setLoadingUnits(true);

    const allUnits: Record<string, UnitDetail[]> = {};
    const initialConditions: Record<string, string> = {};

    for (const asset of row.assets) {
      try {
        const res = await api.get(`/api/loans/${asset.loan_id}/units`);
        const units: UnitDetail[] = res.data?.data ?? [];
        allUnits[asset.loan_id] = units;
        units.forEach((u) => {
          initialConditions[u.id] = u.condition;
        });
      } catch {
        allUnits[asset.loan_id] = [];
      }
    }

    setAssetUnits(allUnits);
    setUnitConditions(initialConditions);
    setLoadingUnits(false);
  };

  // ✅ Konfirmasi semua loan (per asset) dalam batch
  const confirmBatchReturn = async () => {
    if (!selectedRow) return;
    setSubmitting(true);

    let successCount = 0;

    for (const asset of selectedRow.assets) {
      const units = assetUnits[asset.loan_id] ?? [];
      const unit_conditions = units
        .map((u) => ({
          asset_unit_id: u.id,
          return_condition: unitConditions[u.id] ?? "good",
          return_notes: returnNotes?.trim() || null,
        }))
        .filter((uc) => uc.asset_unit_id);

      if (unit_conditions.length === 0) continue;

      try {
        await api.patch(`/api/loans/${asset.loan_id}/return`, {
          unit_conditions,
        });
        successCount++;
      } catch (err: any) {
        toast.error(
          `Gagal proses ${getAssetLabel(asset)}: ${err.response?.data?.message ?? "Error"}`,
        );
      }
    }

    setSubmitting(false);

    if (successCount > 0) {
      toast.success(
        selectedRow.assets.length > 1
          ? `${successCount} aset berhasil dikembalikan! Stok otomatis diupdate.`
          : "Pengembalian berhasil dikonfirmasi! Stok otomatis diupdate.",
      );
      setSelectedRow(null);
      await load(page);
    }
  };

  const getPageTitle = () => {
    if (role === "admin") return "Pengembalian";
    if (role === "dosen") return "Pengembalian Mahasiswa";
    return "Pengembalian Saya";
  };

  const getPageDescription = () => {
    if (role === "admin")
      return "Verifikasi dan konfirmasi pengembalian aset dari peminjam.";
    if (role === "dosen")
      return "Pantau status pengembalian aset dari mahasiswa Anda.";
    return "Lihat status pengembalian aset yang Anda pinjam.";
  };

  return (
    <>
      <PageHeader title={getPageTitle()} description={getPageDescription()} />

      {loading ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Memuat data…
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={ArrowLeftRight}
            title="Tidak ada peminjaman aktif"
            description={
              role === "student"
                ? "Semua peminjaman Anda sudah dikembalikan."
                : "Tidak ada peminjaman dalam proses pengembalian."
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {rows.map((row) => {
              const isMulti = row.assets.length > 1;
              const late = isOverdue(row.return_deadline);

              return (
                <div
                  key={row.id}
                  className="rounded-xl border bg-card p-5 shadow-(--shadow-card)"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* ✅ ID: pakai loan_number kalau ada, fallback ke id.slice */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.loan_number ?? row.id.slice(0, 8)}
                        </span>
                        <StatusBadge status={mapStatus(row.status)} />
                        {late && (
                          <span className="text-xs font-medium text-destructive">
                            ⚠️ Terlambat
                          </span>
                        )}
                      </div>

                      {/* Aset list */}
                      {isMulti ? (
                        <div className="mt-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Package className="size-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-medium">
                              {row.assets.length} aset dalam satu pengajuan:
                            </span>
                          </div>
                          <ul className="ml-5 space-y-0.5">
                            {row.assets.map((asset) => (
                              <li
                                key={asset.loan_id}
                                className="font-display font-semibold text-sm"
                              >
                                • {getAssetLabel(asset)} × {asset.quantity} unit
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <h3 className="mt-1 font-display font-semibold">
                          {getAssetLabel(row.assets[0])} ×{" "}
                          {row.assets[0].quantity} unit
                        </h3>
                      )}

                      {/* Peminjam */}
                      {role !== "student" && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.requester_name}
                          {row.nim_nip && (
                            <span className="font-mono ml-1">
                              · {row.nim_nip}
                            </span>
                          )}
                        </p>
                      )}

                      {/* Tanggal */}
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          late
                            ? "text-destructive font-medium"
                            : "text-muted-foreground",
                        )}
                      >
                        Pinjam {formatDate(row.borrow_date)} → Tenggat{" "}
                        {formatDate(row.return_deadline)}
                      </p>
                    </div>

                    {role === "admin" && (
                      <Button
                        size="sm"
                        variant="brand"
                        onClick={() => openRowDialog(row)}
                      >
                        <CheckCircle className="size-3.5 mr-1" />
                        Proses{isMulti ? ` (${row.assets.length})` : ""}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {role === "admin" && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={handlePageChange}
              loading={loading}
            />
          )}
        </>
      )}

      {/* ── Dialog (Admin Only) ── */}
      {role === "admin" && (
        <Dialog open={!!selectedRow} onOpenChange={() => setSelectedRow(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Proses Pengembalian Aset</DialogTitle>
              <DialogDescription>
                Verifikasi kondisi barang yang dikembalikan oleh peminjam
              </DialogDescription>
            </DialogHeader>

            {selectedRow && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Detail Peminjaman{" "}
                    {selectedRow.loan_number && (
                      <span className="font-mono normal-case">
                        · {selectedRow.loan_number}
                      </span>
                    )}
                  </p>
                  <p className="font-medium">
                    {selectedRow.requester_name}
                    {selectedRow.nim_nip && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        · {selectedRow.nim_nip}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pinjam {formatDate(selectedRow.borrow_date)} → Tenggat{" "}
                    <span
                      className={
                        isOverdue(selectedRow.return_deadline)
                          ? "text-destructive font-medium"
                          : ""
                      }
                    >
                      {formatDate(selectedRow.return_deadline)}
                      {isOverdue(selectedRow.return_deadline) &&
                        " ⚠️ Terlambat"}
                    </span>
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Verifikasi Kondisi Barang
                  </p>
                  {loadingUnits ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Memuat data
                      unit…
                    </div>
                  ) : (
                    selectedRow.assets.map((asset) => {
                      const units = assetUnits[asset.loan_id] ?? [];
                      return (
                        <div key={asset.loan_id} className="space-y-2">
                          <p className="text-sm font-semibold flex items-center gap-1.5">
                            <Package className="size-3.5 text-muted-foreground" />
                            {getAssetLabel(asset)} × {asset.quantity} unit
                          </p>
                          {units.length === 0 ? (
                            <p className="ml-5 text-xs text-muted-foreground">
                              Tidak ada detail unit.
                            </p>
                          ) : (
                            <div className="ml-5 space-y-2">
                              {units.map((u) => (
                                <div
                                  key={u.id}
                                  className="flex items-center gap-3 rounded-md border p-2.5"
                                >
                                  <div className="flex-1">
                                    <p className="font-mono text-xs font-medium">
                                      {u.unit_code}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      Kondisi sebelumnya: {u.condition}
                                    </p>
                                  </div>
                                  <Select
                                    value={unitConditions[u.id] ?? "good"}
                                    onValueChange={(v) =>
                                      setUnitConditions((prev) => ({
                                        ...prev,
                                        [u.id]: v,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="w-40 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="good">
                                        ✅ Baik
                                      </SelectItem>
                                      <SelectItem value="minor">
                                        ⚠️ Rusak Ringan
                                      </SelectItem>
                                      <SelectItem value="major">
                                        ❌ Rusak Berat
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">
                    Catatan Pengembalian (opsional)
                  </Label>
                  <Textarea
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    rows={2}
                    placeholder="Cth: Lensa retak pada unit #2, perlu perbaikan…"
                  />
                </div>

                <div className="rounded-sm bg-blue-500/10 border border-blue-500/20 p-2.5">
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    💡 <strong>Sistem otomatis akan:</strong> mengupdate status
                    peminjaman → selesai, memperbarui stok barang, dan mengirim
                    notifikasi ke peminjam.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setSelectedRow(null)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button
                variant="brand"
                onClick={confirmBatchReturn}
                disabled={submitting || loadingUnits}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="size-4 mr-1" />
                    Konfirmasi Selesai
                    {(selectedRow?.assets.length ?? 0) > 1
                      ? ` (${selectedRow?.assets.length} aset)`
                      : ""}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
