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
import api from "../lib/api";
import { toast } from "sonner";
import { Input } from "../components/ui/input";

export const Route = createFileRoute("/_app/pengambilan")({
  component: PengambilanPage,
  head: () => ({ meta: [{ title: "Konfirmasi Pengambilan · MNP Lab Loan" }] }),
});

// ── Types ─────────────────────────────────────────────────────
interface LoanItem {
  id: string;
  asset_name: string;
  merk: string | null;
  type: string | null;
  quantity: number;
  requester_name: string;
  nim_nip: string | null;
  requester_role: string;
  borrow_date: string;
  return_deadline: string;
  category: string;
  notes: string | null;
  status: string;
  created_at: string; // ✅ untuk grouping
}

interface LoanGroup {
  groupKey: string;
  requester_name: string;
  nim_nip: string | null;
  requester_role: string;
  requester_id: string;
  borrow_date: string;
  return_deadline: string;
  category: string;
  notes: string | null;
  created_at: string;
  items: LoanItem[];
}

// ── Helpers ───────────────────────────────────────────────────
const GROUP_WINDOW_MS = 10_000; // FIX: 10 detik

function groupLoans(items: LoanItem[]): LoanGroup[] {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const groups: LoanGroup[] = [];
  for (const item of sorted) {
    const existing = groups.find(
      (g) =>
        g.requester_id === item.requester_name && // fallback grouping
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
        requester_name: item.requester_name,
        nim_nip: item.nim_nip,
        requester_role: item.requester_role,
        requester_id: item.requester_name,
        borrow_date: item.borrow_date,
        return_deadline: item.return_deadline,
        category: item.category,
        notes: item.notes,
        created_at: item.created_at,
        items: [item],
      });
    }
  }
  return groups;
}

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

const getMerkLabel = (item: LoanItem) => {
  const parts = [item.merk, item.type].filter(Boolean).join(" ");
  return parts || item.asset_name;
};

// ── Component ─────────────────────────────────────────────────
function PengambilanPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<LoanGroup | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (role && role !== "admin") navigate({ to: "/dashboard" });
  }, [role]);

  const loadLoans = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/loans");
      const all: LoanItem[] = res.data?.data ?? [];
      // Hanya tampilkan yang status approved_admin (siap diambil)
      setLoans(all.filter((l: any) => l.status === "approved_admin"));
    } catch {
      toast.error("Gagal memuat data peminjaman");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLoans();
  }, []);

  const openConfirm = (group: LoanGroup) => {
    setSelectedGroup(group);
    setDialogOpen(true);
  };

  // ✅ Konfirmasi semua loan dalam group
  const handleConfirmGroup = async () => {
    if (!selectedGroup) return;
    try {
      setConfirming(true);
      let successCount = 0;

      for (const loan of selectedGroup.items) {
        try {
          await api.patch(`/api/loans/${loan.id}/pickup`);
          successCount++;
        } catch (err: any) {
          toast.error(
            `Gagal konfirmasi ${getMerkLabel(loan)}: ${err.response?.data?.message ?? "Error"}`,
          );
        }
      }

      if (successCount > 0) {
        toast.success(
          selectedGroup.items.length > 1
            ? `${successCount} aset berhasil dikonfirmasi pengambilannya!`
            : `Pengambilan "${getMerkLabel(selectedGroup.items[0])}" berhasil dikonfirmasi!`,
        );
        setDialogOpen(false);
        setSelectedGroup(null);
        await loadLoans();
      }
    } finally {
      setConfirming(false);
    }
  };

  // Filter by search
  const allGrouped = groupLoans(loans);
  const filtered = allGrouped.filter((g) => {
    const q = search.toLowerCase();
    return (
      !q ||
      g.requester_name.toLowerCase().includes(q) ||
      g.items.some(
        (i) =>
          getMerkLabel(i).toLowerCase().includes(q) ||
          (g.nim_nip ?? "").includes(q),
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
          placeholder="Cari nama, aset, NIM/NIP…"
          className="pl-9"
        />
      </div>

      {!loading && loans.length > 0 && (
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
              loans.length === 0
                ? "Tidak ada pengambilan pending"
                : "Tidak ada hasil"
            }
            description={
              loans.length === 0
                ? "Belum ada peminjaman yang menunggu konfirmasi pengambilan."
                : "Coba kata kunci lain."
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((group) => {
            const isMulti = group.items.length > 1;
            return (
              <div
                key={group.groupKey}
                className="rounded-xl border bg-card p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Aset */}
                    {isMulti ? (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Package className="size-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">
                            {group.items.length} aset dalam satu pengajuan:
                          </span>
                        </div>
                        <ul className="ml-5 space-y-0.5">
                          {group.items.map((item) => (
                            <li key={item.id} className="font-semibold text-sm">
                              • {getMerkLabel(item)} × {item.quantity} unit
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
                            {getMerkLabel(group.items[0])}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {group.items[0].quantity} unit
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Peminjam */}
                    <div className="flex items-start gap-2">
                      <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">
                          {group.requester_name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {group.nim_nip ?? "NIM/NIP belum diisi"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {roleLabel[group.requester_role] ??
                            group.requester_role}
                        </p>
                      </div>
                    </div>

                    {/* Tanggal & Kategori */}
                    <div className="flex items-start gap-2">
                      <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm">
                          {formatDate(group.borrow_date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Kembali: {formatDate(group.return_deadline)} ·{" "}
                          {categoryLabel[group.category] ?? group.category}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tombol */}
                  <div className="shrink-0 self-center">
                    <Button onClick={() => openConfirm(group)}>
                      <CheckCircle2 className="mr-2 size-4" />
                      Konfirmasi{isMulti ? ` (${group.items.length} Aset)` : ""}
                    </Button>
                  </div>
                </div>

                {group.notes && (
                  <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    📝 {group.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
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

          {selectedGroup && (
            <div className="space-y-4 py-1">
              {/* Ringkasan */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
                {/* Aset */}
                {selectedGroup.items.length > 1 ? (
                  <div className="flex gap-3 items-start">
                    <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">
                        {selectedGroup.items.length} Aset:
                      </p>
                      <ul className="mt-0.5 space-y-0.5">
                        {selectedGroup.items.map((i) => (
                          <li
                            key={i.id}
                            className="text-xs text-muted-foreground"
                          >
                            • {getMerkLabel(i)} × {i.quantity} unit
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
                        {getMerkLabel(selectedGroup.items[0])}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedGroup.items[0].quantity} unit
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 items-start">
                  <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">
                      {selectedGroup.requester_name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      NIM/NIP: {selectedGroup.nim_nip ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p>
                    {formatDate(selectedGroup.borrow_date)} s.d.{" "}
                    {formatDate(selectedGroup.return_deadline)}
                  </p>
                </div>
              </div>

              {/* Checklist */}
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
            <Button onClick={handleConfirmGroup} disabled={confirming}>
              {confirming ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />{" "}
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
