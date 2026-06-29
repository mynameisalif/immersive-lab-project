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

// ── Types ─────────────────────────────────────────────────────
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
  created_at: string; // ✅ untuk grouping
  category?: string; // ✅ untuk grouping
}

interface RowGroup {
  groupKey: string;
  requester_id: string;
  requester_name: string;
  nim_nip: string | null;
  borrow_date: string;
  return_deadline: string;
  created_at: string;
  items: Row[];
}

interface UnitDetail {
  id: string;
  unit_code: string;
  condition: string;
  loan_status: string;
}

// ── Helpers ───────────────────────────────────────────────────
const GROUP_WINDOW_MS = 10_000; // FIX: 10 detik

function groupRows(items: Row[]): RowGroup[] {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const groups: RowGroup[] = [];
  for (const item of sorted) {
    const existing = groups.find(
      (g) =>
        g.requester_id === item.requester_id &&
        g.borrow_date === item.borrow_date &&
        g.return_deadline === item.return_deadline &&
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
        requester_id: item.requester_id ?? "",
        requester_name: item.requester_name ?? "—",
        nim_nip: item.nim_nip ?? null,
        borrow_date: item.borrow_date,
        return_deadline: item.return_deadline,
        created_at: item.created_at,
        items: [item],
      });
    }
  }
  return groups;
}

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

const getMerkLabel = (r: Row) => {
  const parts = [r.merk, r.type].filter(Boolean).join(" ");
  return parts || r.asset_name;
};

const isOverdue = (deadline: string) => new Date(deadline) < new Date();

// ── Component ─────────────────────────────────────────────────
function Pengembalian() {
  const { user, role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog state
  const [selectedGroup, setSelectedGroup] = useState<RowGroup | null>(null);
  const [groupUnits, setGroupUnits] = useState<Record<string, UnitDetail[]>>(
    {},
  );
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

      // ✅ FIX: hanya picked_up dan overdue (hapus approved_admin!)
      let filtered: Row[] = data.filter((r: any) =>
        ["picked_up", "overdue"].includes(r.status),
      );

      if (role === "student") {
        filtered = filtered.filter((r: any) => r.requester_id === user?.id);
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
          created_at: r.created_at,
          category: r.category ?? "",
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

  // ✅ Buka dialog untuk group — fetch units semua loan dalam group
  const openGroupDialog = async (group: RowGroup) => {
    setSelectedGroup(group);
    setReturnNotes("");
    setUnitConditions({});
    setGroupUnits({});
    setLoadingUnits(true);

    const allUnits: Record<string, UnitDetail[]> = {};
    const initialConditions: Record<string, string> = {};

    for (const loan of group.items) {
      try {
        const res = await api.get(`/api/loans/${loan.id}/units`);
        const units: UnitDetail[] = res.data?.data ?? [];
        allUnits[loan.id] = units;
        units.forEach((u) => {
          initialConditions[u.id] = u.condition;
        });
      } catch {
        allUnits[loan.id] = [];
      }
    }

    setGroupUnits(allUnits);
    setUnitConditions(initialConditions);
    setLoadingUnits(false);
  };

  // ✅ Konfirmasi semua loan dalam group
  const confirmGroupReturn = async () => {
    if (!selectedGroup) return;
    setSubmitting(true);

    let successCount = 0;

    for (const loan of selectedGroup.items) {
      const loanUnits = groupUnits[loan.id] ?? [];
      const unit_conditions = loanUnits
        .map((u) => ({
          asset_unit_id: u.id,
          return_condition: unitConditions[u.id] ?? "good",
          return_notes: returnNotes?.trim() || null,
        }))
        .filter((uc) => uc.asset_unit_id);

      if (unit_conditions.length === 0) continue;

      try {
        await api.patch(`/api/loans/${loan.id}/return`, { unit_conditions });
        successCount++;
      } catch (err: any) {
        toast.error(
          `Gagal proses ${getMerkLabel(loan)}: ${err.response?.data?.message ?? "Error"}`,
        );
      }
    }

    setSubmitting(false);

    if (successCount > 0) {
      toast.success(
        selectedGroup.items.length > 1
          ? `${successCount} aset berhasil dikembalikan! Stok otomatis diupdate.`
          : "Pengembalian berhasil dikonfirmasi! Stok otomatis diupdate.",
      );
      setSelectedGroup(null);
      void load();
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

  const groups = groupRows(rows);

  return (
    <>
      <PageHeader title={getPageTitle()} description={getPageDescription()} />

      {loading ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Memuat data…
        </div>
      ) : groups.length === 0 ? (
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
        <div className="mt-6 space-y-3">
          {groups.map((group) => {
            const isMulti = group.items.length > 1;
            const late = isOverdue(group.return_deadline);

            return (
              <div
                key={group.groupKey}
                className="rounded-xl border bg-card p-5 shadow-(--shadow-card)"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* ID & Status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">
                        {group.groupKey.slice(0, 8)}
                      </span>
                      <StatusBadge status={mapStatus(group.items[0].status)} />
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
                            {group.items.length} aset dalam satu pengajuan:
                          </span>
                        </div>
                        <ul className="ml-5 space-y-0.5">
                          {group.items.map((item) => (
                            <li
                              key={item.id}
                              className="font-display font-semibold text-sm"
                            >
                              • {getMerkLabel(item)}
                              {item.quantity ? ` × ${item.quantity} unit` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <h3 className="mt-1 font-display font-semibold">
                        {getMerkLabel(group.items[0])}
                        {group.items[0].quantity
                          ? ` × ${group.items[0].quantity} unit`
                          : ""}
                      </h3>
                    )}

                    {/* Peminjam */}
                    {role !== "student" && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {group.requester_name}
                        {group.nim_nip && (
                          <span className="font-mono ml-1">
                            · {group.nim_nip}
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
                      Pinjam {formatDate(group.borrow_date)} → Tenggat{" "}
                      {formatDate(group.return_deadline)}
                    </p>
                  </div>

                  {/* Aksi admin */}
                  {role === "admin" && (
                    <Button
                      size="sm"
                      variant="brand"
                      onClick={() => openGroupDialog(group)}
                    >
                      <CheckCircle className="size-3.5 mr-1" />
                      Proses{isMulti ? ` (${group.items.length})` : ""}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dialog (Admin Only) ── */}
      {role === "admin" && (
        <Dialog
          open={!!selectedGroup}
          onOpenChange={() => setSelectedGroup(null)}
        >
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Proses Pengembalian Aset</DialogTitle>
              <DialogDescription>
                Verifikasi kondisi barang yang dikembalikan oleh peminjam
              </DialogDescription>
            </DialogHeader>

            {selectedGroup && (
              <div className="space-y-4">
                {/* Info Peminjam */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Detail Peminjaman
                  </p>
                  <p className="font-medium">
                    {selectedGroup.requester_name}
                    {selectedGroup.nim_nip && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        · {selectedGroup.nim_nip}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pinjam {formatDate(selectedGroup.borrow_date)} → Tenggat{" "}
                    <span
                      className={
                        isOverdue(selectedGroup.return_deadline)
                          ? "text-destructive font-medium"
                          : ""
                      }
                    >
                      {formatDate(selectedGroup.return_deadline)}
                      {isOverdue(selectedGroup.return_deadline) &&
                        " ⚠️ Terlambat"}
                    </span>
                  </p>
                </div>

                {/* Kondisi Unit per Aset */}
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
                    selectedGroup.items.map((loan) => {
                      const units = groupUnits[loan.id] ?? [];
                      return (
                        <div key={loan.id} className="space-y-2">
                          {/* Header aset */}
                          <p className="text-sm font-semibold flex items-center gap-1.5">
                            <Package className="size-3.5 text-muted-foreground" />
                            {getMerkLabel(loan)}
                            {loan.quantity ? ` × ${loan.quantity} unit` : ""}
                          </p>
                          {/* Units */}
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

                {/* Catatan */}
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
                onClick={() => setSelectedGroup(null)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button
                variant="brand"
                onClick={confirmGroupReturn}
                disabled={submitting || loadingUnits}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="size-4 mr-1" />
                    Konfirmasi Selesai
                    {(selectedGroup?.items.length ?? 0) > 1
                      ? ` (${selectedGroup?.items.length} aset)`
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
