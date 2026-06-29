import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { StatusBadge, type LoanStatus } from "../components/common/StatusBadge";
import { useAuth } from "../lib/auth";
import { EmptyState } from "../components/common/EmptyState";
import {
  CheckSquare,
  X,
  Loader2,
  FileText,
  ExternalLink,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import {
  getPendingApprovals,
  approveLoan,
  rejectLoan,
} from "../services/approval.service";

export const Route = createFileRoute("/_app/approval")({
  component: ApprovalPage,
  head: () => ({ meta: [{ title: "Approval · MNP Lab Loan" }] }),
});

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────
interface Item {
  id: string;
  notes: string;
  status: LoanStatus;
  borrow_date: string;
  return_deadline: string;
  created_at: string; // ✅ tambah untuk grouping
  requester_id: string;
  requester_role?: string;
  asset_name?: string;
  merk?: string;
  type?: string;
  quantity?: number;
  requester_name?: string;
  nim_nip?: string | null;
  category?: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
}

// ✅ Group dari beberapa loan yang disubmit bersama
interface LoanGroup {
  groupKey: string; // ID unik group (pakai ID item pertama)
  requester_id: string;
  requester_name: string;
  nim_nip: string | null;
  requester_role: string;
  borrow_date: string;
  return_deadline: string;
  category: string;
  notes: string;
  status: LoanStatus;
  created_at: string;
  attachment_url: string | null;
  attachment_name: string | null;
  items: Item[]; // semua loan dalam group ini
}

// ── Helpers ───────────────────────────────────────────────────
const mapStatus = (s: string): LoanStatus => {
  const map: Record<string, LoanStatus> = {
    pending: "pending_dosen",
    approved_dosen: "pending_admin",
    approved_admin: "approved",
    rejected: "rejected",
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

const formatCategory = (cat?: string) => {
  if (!cat) return "—";
  if (cat === "kelas_praktikum") return "Kelas / Praktikum";
  if (cat === "event_kegiatan") return "Event / Kegiatan";
  return cat;
};

const getMerkLabel = (r: Item) => {
  const parts = [r.merk, r.type].filter(Boolean).join(" ");
  return parts || r.asset_name || "—";
};

// ✅ Fungsi grouping: gabung loan yang disubmit bersama
// Kriteria: requester + borrow_date + return_deadline + category
//           + created_at dalam rentang 60 detik
// ✅ FIX: 10 detik (bukan 60 detik)
// Loan dalam 1 batch disubmit dalam ~1-2 detik (JavaScript loop).
// Dua submission manual terpisah butuh waktu > 10 detik.
const GROUP_WINDOW_MS = 10_000;

function groupLoans(items: Item[]): LoanGroup[] {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const groups: LoanGroup[] = [];

  for (const item of sorted) {
    // ✅ FIX: tambah pengecekan notes — batch yang sama punya notes yang sama
    const existing = groups.find(
      (g) =>
        g.requester_id === item.requester_id &&
        g.borrow_date === item.borrow_date &&
        g.return_deadline === item.return_deadline &&
        g.category === item.category &&
        g.notes === item.notes &&
        Math.abs(
          new Date(g.created_at).getTime() -
            new Date(item.created_at).getTime(),
        ) <= GROUP_WINDOW_MS,
    );

    if (existing) {
      existing.items.push(item);
    } else {
      // Buat group baru
      groups.push({
        groupKey: item.id,
        requester_id: item.requester_id,
        requester_name: item.requester_name ?? "—",
        nim_nip: item.nim_nip ?? null,
        requester_role: item.requester_role ?? "",
        borrow_date: item.borrow_date,
        return_deadline: item.return_deadline,
        category: item.category ?? "",
        notes: item.notes,
        status: item.status,
        created_at: item.created_at,
        attachment_url: item.attachment_url ?? null,
        attachment_name: item.attachment_name ?? null,
        items: [item],
      });
    }
  }

  return groups;
}

// ── Main Component ────────────────────────────────────────────
function ApprovalPage() {
  const { role, isKaprodi } = useAuth();
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const canAccess = role === "admin" || (role === "dosen" && isKaprodi);

  const getPageTitle = () => {
    if (role === "admin") return "Approval Final";
    if (isKaprodi) return "Approval Mahasiswa";
    return "Approval";
  };

  const getPageDesc = () => {
    if (role === "admin")
      return "Approve request dari staff dan dosen, serta mahasiswa yang sudah disetujui Kaprodi.";
    if (isKaprodi)
      return "Approve atau tolak request peminjaman dari mahasiswa.";
    return "";
  };

  const load = async () => {
    if (!canAccess) return;
    try {
      const res = await getPendingApprovals();
      const data = res.data?.data ?? [];
      const list: Item[] = data.map((r: any) => ({
        id: r.id,
        notes: r.notes ?? "",
        status: mapStatus(r.status),
        borrow_date: r.borrow_date,
        return_deadline: r.return_deadline,
        created_at: r.created_at, // ✅ ambil dari API
        requester_id: r.requester_id,
        requester_role: r.requester_role ?? "",
        asset_name: r.asset_name ?? "—",
        merk: r.merk ?? "",
        type: r.type ?? "",
        quantity: r.quantity ?? 0,
        requester_name: r.requester_name ?? "—",
        nim_nip: r.nim_nip ?? null,
        category: r.category ?? null,
        attachment_url: r.attachment_url ?? null,
        attachment_name: r.attachment_name ?? null,
      }));
      setRows(list);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    void load();
  }, [role, isKaprodi]);

  // ✅ Approve SEMUA loan dalam satu group
  const approveGroup = async (group: LoanGroup) => {
    setLoading(true);
    let successCount = 0;
    for (const item of group.items) {
      try {
        await approveLoan(item.id, "");
        successCount++;
      } catch (err: any) {
        toast.error(
          `Gagal setujui ${getMerkLabel(item)}: ${err.response?.data?.message ?? "Error"}`,
        );
      }
    }
    setLoading(false);
    if (successCount > 0) {
      toast.success(
        group.items.length > 1
          ? `${successCount} aset disetujui! ${isKaprodi ? "Menunggu konfirmasi Admin." : ""}`
          : `Peminjaman disetujui! ${isKaprodi ? "Menunggu konfirmasi Admin." : ""}`,
      );
      void load();
    }
  };

  // ✅ Reject SEMUA loan dalam satu group dengan alasan yang sama
  const rejectGroup = async (group: LoanGroup, reason: string) => {
    if (!reason) return toast.error("Alasan penolakan wajib diisi");
    setLoading(true);
    let successCount = 0;
    for (const item of group.items) {
      try {
        await rejectLoan(item.id, reason);
        successCount++;
      } catch (err: any) {
        toast.error(
          `Gagal tolak ${getMerkLabel(item)}: ${err.response?.data?.message ?? "Error"}`,
        );
      }
    }
    setLoading(false);
    if (successCount > 0) {
      toast.success("Pengajuan ditolak");
      void load();
    }
  };

  if (!canAccess) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Halaman ini tidak tersedia untuk role Anda.
      </div>
    );
  }

  // ✅ Group loans sebelum render
  const groups = groupLoans(rows);

  return (
    <>
      <PageHeader title={getPageTitle()} description={getPageDesc()} />

      {groups.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={CheckSquare}
            title="Tidak ada antrian"
            description="Semua pengajuan sudah ditangani."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {groups.map((group) => (
            <GroupCard
              key={group.groupKey}
              group={group}
              loading={loading}
              isKaprodi={!!isKaprodi}
              onApprove={() => approveGroup(group)}
              onReject={(reason) => rejectGroup(group, reason)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── GroupCard Component ───────────────────────────────────────
function GroupCard({
  group,
  loading,
  isKaprodi,
  onApprove,
  onReject,
}: {
  group: LoanGroup;
  loading: boolean;
  isKaprodi: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const isMulti = group.items.length > 1;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-(--shadow-card)">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* ID & Status & Role badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">
              {group.groupKey.slice(0, 8)}
            </span>
            <StatusBadge status={group.status} />
            {group.requester_role && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                {group.requester_role === "student"
                  ? "Mahasiswa"
                  : group.requester_role === "dosen"
                    ? "Dosen"
                    : group.requester_role === "staff"
                      ? "Staff"
                      : group.requester_role}
              </span>
            )}
          </div>

          {/* ✅ Daftar aset — satu baris jika hanya 1, list jika lebih */}
          {isMulti ? (
            <div className="mt-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Package className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {group.items.length} aset dalam satu pengajuan:
                </span>
              </div>
              <ul className="space-y-0.5 ml-5">
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

          {/* Keterangan */}
          {group.notes && (
            <p className="mt-1 text-sm text-muted-foreground">{group.notes}</p>
          )}

          {/* Peminjam */}
          <p className="mt-1 text-sm text-muted-foreground">
            {group.requester_name}{" "}
            {group.nim_nip && (
              <span className="font-mono">· {group.nim_nip}</span>
            )}
          </p>

          {/* Kategori */}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Kategori:</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                group.category === "event_kegiatan"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {formatCategory(group.category)}
            </span>
          </div>

          {/* Proposal */}
          {group.category === "event_kegiatan" && group.attachment_url && (
            <a
              href={`${API_URL}${group.attachment_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <FileText className="size-3.5 text-muted-foreground" />
              {group.attachment_name ?? "Lihat Proposal"}
              <ExternalLink className="size-3 text-muted-foreground" />
            </a>
          )}

          {/* Tanggal */}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Pinjam {formatDate(group.borrow_date)} → Kembali{" "}
            {formatDate(group.return_deadline)}
          </p>
        </div>

        {/* Tombol aksi */}
        <div className="flex gap-2 shrink-0">
          <RejectDialog onConfirm={onReject} disabled={loading} />
          <Button variant="brand" onClick={onApprove} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckSquare className="size-4" />
            )}{" "}
            {isMulti ? `Setujui Semua (${group.items.length})` : "Setujui"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── RejectDialog ──────────────────────────────────────────────
function RejectDialog({
  onConfirm,
  disabled,
}: {
  onConfirm: (reason: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <X className="size-4" /> Tolak
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tolak Pengajuan</DialogTitle>
          <DialogDescription>
            Alasan penolakan akan dikirim ke semua aset dalam pengajuan ini.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Alasan penolakan…"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!reason.trim()) return;
              onConfirm(reason);
              setOpen(false);
              setReason("");
            }}
          >
            Tolak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
