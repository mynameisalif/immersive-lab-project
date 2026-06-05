import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge, type LoanStatus } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeftRight, CheckCircle, Loader2, Package } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { getLoans } from "@/services/loan.service";
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

export const Route = createFileRoute("/_app/pengembalian")({
  component: Pengembalian,
  head: () => ({ meta: [{ title: "Pengembalian · MNP Lab Loan" }] }),
});

interface Row {
  id: string;
  status: string;
  notes: string;
  asset_name: string;
  borrow_date: string;
  return_deadline: string;
  returned_at?: string | null;
  merk?: string | null;
  type?: string | null;
  requester_name?: string;
  requester_id?: string;
  nim_nip?: string | null;
  quantity?: number;
}

interface UnitDetail {
  id: string;
  unit_code: string;
  condition: string;
  loan_status: string;
}

const mapStatus = (s: string): LoanStatus => {
  const map: Record<string, LoanStatus> = {
    approved_admin: "approved",
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

function Pengembalian() {
  const { user, role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Row | null>(null);
  const [units, setUnits] = useState<UnitDetail[]>([]);
  const [unitConditions, setUnitConditions] = useState<Record<string, string>>(
    {},
  );
  const [returnNotes, setReturnNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getLoans();
      const data = res.data?.data ?? [];

      let filtered: Row[] = data.filter((r: any) =>
        ["picked_up", "overdue", "approved_admin"].includes(r.status),
      );

      if (role === "student") {
        filtered = filtered.filter((r) => r.requester_id === user?.id);
      }

      const mapped: Row[] = filtered
        .map((r: any) => ({
          id: r.id,
          status: r.status,
          notes: r.notes ?? "—",
          asset_name: r.asset_name ?? "—",
          borrow_date: r.borrow_date,
          return_deadline: r.return_deadline,
          returned_at: r.returned_at ?? null,
          merk: r.merk ?? null,
          type: r.type ?? null,
          requester_name: r.requester_name ?? "—",
          requester_id: r.requester_id,
          nim_nip: r.nim_nip ?? null,
          quantity: r.quantity ?? 1,
        }))
        .sort(
          (a: Row, b: Row) =>
            new Date(a.return_deadline).getTime() -
            new Date(b.return_deadline).getTime(),
        );

      setRows(mapped);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user, role]);

  const openDialog = async (loan: Row) => {
    setSelectedLoan(loan);
    setReturnNotes("");
    setUnitConditions({});
    setLoadingUnits(true);
    try {
      const res = await api.get(`/api/loans/${loan.id}/units`);
      const unitData: UnitDetail[] = res.data?.data ?? [];
      setUnits(unitData);
      const initialConditions: Record<string, string> = {};
      unitData.forEach((u) => {
        initialConditions[u.id] = u.condition;
      });
      setUnitConditions(initialConditions);
    } catch (err: any) {
      console.error("Error loading units:", err);
      toast.error("Gagal memuat data unit");
      setUnits([]);
    } finally {
      setLoadingUnits(false);
    }
  };

  const confirmReturn = async () => {
    if (!selectedLoan) return;

    setSubmitting(true);
    try {
      // Format request body sesuai backend
      const unit_conditions = Object.entries(unitConditions)
        .map(([asset_unit_id, return_condition]) => ({
          asset_unit_id,
          return_condition,
          return_notes: returnNotes?.trim() || null,
        }))
        .filter((uc) => uc.asset_unit_id && uc.return_condition); // Validate

      if (unit_conditions.length === 0) {
        toast.error("Pilih kondisi untuk minimal satu unit");
        setSubmitting(false);
        return;
      }

      console.log("Sending PATCH request with:", {
        loan_id: selectedLoan.id,
        body: { unit_conditions },
      });

      const res = await api.patch(`/api/loans/${selectedLoan.id}/return`, {
        unit_conditions,
      });

      console.log("Response:", res);
      toast.success(
        "Pengembalian berhasil dikonfirmasi! Stok otomatis diupdate.",
      );
      setSelectedLoan(null);
      void load();
    } catch (err: any) {
      console.error("Confirm return error:", err.response || err);
      const errorMsg = err.response?.data?.message ?? "Terjadi kesalahan";
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const getAssetLabel = (r: Row) => {
    const parts = [r.merk, r.type].filter(Boolean).join(" ");
    return parts || r.asset_name;
  };

  const isOverdue = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  const getPageTitle = () => {
    if (role === "admin") return "Pengembalian";
    if (role === "dosen") return "Pengembalian Mahasiswa";
    return "Pengembalian Saya";
  };

  const getPageDescription = () => {
    if (role === "admin") {
      return "Verifikasi dan konfirmasi pengembalian aset dari peminjam.";
    }
    if (role === "dosen") {
      return "Pantau status pengembalian aset dari mahasiswa Anda.";
    }
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
        <div className="mt-6 overflow-x-auto rounded-xl border bg-card shadow-(--shadow-card)">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ID</th>
                {role !== "student" && <th className="px-4 py-3">Peminjam</th>}
                <th className="px-4 py-3">Aset</th>
                <th className="px-4 py-3">Pinjam</th>
                <th className="px-4 py-3">Tenggat</th>
                <th className="px-4 py-3">Status</th>
                {role === "admin" && <th className="px-4 py-3">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.id.slice(0, 8)}
                  </td>
                  {role !== "student" && (
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.requester_name}</p>
                      {r.nim_nip && (
                        <p className="font-mono text-xs text-muted-foreground">
                          {r.nim_nip}
                        </p>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">{getAssetLabel(r)}</td>
                  <td className="px-4 py-3">{formatDate(r.borrow_date)}</td>
                  <td
                    className={cn(
                      "px-4 py-3",
                      isOverdue(r.return_deadline) && r.status !== "returned"
                        ? "text-destructive font-medium"
                        : "",
                    )}
                  >
                    {formatDate(r.return_deadline)}
                    {isOverdue(r.return_deadline) &&
                      r.status !== "returned" && (
                        <span className="ml-1 text-[10px]">⚠️ Terlambat</span>
                      )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={mapStatus(r.status)} />
                  </td>
                  {role === "admin" && (
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="brand"
                        onClick={() => openDialog(r)}
                      >
                        <CheckCircle className="size-3.5" />
                        Proses
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Dialog (Admin Only) ── */}
      {role === "admin" && (
        <Dialog
          open={!!selectedLoan}
          onOpenChange={() => setSelectedLoan(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Proses Pengembalian Aset</DialogTitle>
              <DialogDescription>
                Verifikasi kondisi barang yang dikembalikan oleh peminjam
              </DialogDescription>
            </DialogHeader>

            {selectedLoan && (
              <div className="space-y-4">
                {/* Info Peminjam */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Detail Peminjaman
                  </p>
                  <p className="font-medium">
                    {selectedLoan.requester_name}
                    {selectedLoan.nim_nip && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        · {selectedLoan.nim_nip}
                      </span>
                    )}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Aset:</span>{" "}
                    {getAssetLabel(selectedLoan)}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Tenggat:</span>{" "}
                    <span
                      className={cn(
                        isOverdue(selectedLoan.return_deadline)
                          ? "text-destructive font-medium"
                          : "",
                      )}
                    >
                      {formatDate(selectedLoan.return_deadline)}
                      {isOverdue(selectedLoan.return_deadline) &&
                        " ⚠️ Terlambat"}
                    </span>
                  </p>
                  {selectedLoan.notes && selectedLoan.notes !== "—" && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Keterangan:</span>{" "}
                      {selectedLoan.notes}
                    </p>
                  )}
                </div>

                {/* Kondisi Unit */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Verifikasi Kondisi Barang
                  </p>
                  {loadingUnits ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Memuat data unit…
                    </div>
                  ) : units.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Tidak ada detail unit tersedia.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {units.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 rounded-md border p-2.5"
                        >
                          <Package className="size-4 shrink-0 text-muted-foreground" />
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
                              <SelectItem value="good">✅ Baik</SelectItem>
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

                {/* Catatan Admin */}
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

                {/* Info sistem */}
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
                onClick={() => setSelectedLoan(null)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button
                variant="brand"
                onClick={confirmReturn}
                disabled={submitting || loadingUnits}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="size-4" />
                    Konfirmasi Selesai
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
