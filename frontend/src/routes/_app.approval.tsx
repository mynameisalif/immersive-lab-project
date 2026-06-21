import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { StatusBadge, type LoanStatus } from "../components/common/StatusBadge";
import { useAuth } from "../lib/auth";
import { EmptyState } from "../components/common/EmptyState";
import { CheckSquare, X, Loader2, FileText, ExternalLink } from "lucide-react";
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

interface Item {
  id: string;
  notes: string;
  status: LoanStatus;
  borrow_date: string;
  return_deadline: string;
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

function ApprovalPage() {
  // ✅ useAuth dipanggil di dalam component
  const { role, isKaprodi } = useAuth();
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  // Guard: hanya admin dan kaprodi yang bisa akses
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

  const decide = async (
    loanId: string,
    decision: "approved" | "rejected",
    reason?: string,
  ) => {
    setLoading(true);
    try {
      if (decision === "approved") {
        await approveLoan(loanId, reason ?? "");
        toast.success(
          isKaprodi
            ? "Disetujui! Menunggu konfirmasi Admin."
            : "Peminjaman berhasil disetujui",
        );
      } else {
        if (!reason) return toast.error("Alasan penolakan wajib diisi");
        await rejectLoan(loanId, reason);
        toast.success("Peminjaman ditolak");
      }
      void load();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const getMerkLabel = (r: Item) => {
    const parts = [r.merk, r.type].filter(Boolean).join(" ");
    return parts || r.asset_name || "—";
  };

  // Guard: jika bukan admin/kaprodi
  if (!canAccess) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Halaman ini tidak tersedia untuk role Anda.
      </div>
    );
  }

  return (
    <>
      <PageHeader title={getPageTitle()} description={getPageDesc()} />

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={CheckSquare}
            title="Tidak ada antrian"
            description="Semua pengajuan sudah ditangani."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border bg-card p-5 shadow-(--shadow-card)"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* ID & Status */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.id.slice(0, 8)}
                    </span>
                    <StatusBadge status={r.status} />
                    {/* Badge role peminjam */}
                    {r.requester_role && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                        {r.requester_role === "student"
                          ? "Mahasiswa"
                          : r.requester_role === "dosen"
                            ? "Dosen"
                            : r.requester_role === "staff"
                              ? "Staff"
                              : r.requester_role}
                      </span>
                    )}
                  </div>

                  {/* Aset */}
                  <h3 className="mt-1 font-display font-semibold">
                    {getMerkLabel(r)}
                    {r.quantity ? ` × ${r.quantity} unit` : ""}
                  </h3>

                  {/* Keterangan */}
                  {r.notes && (
                    <p className="text-sm text-muted-foreground">{r.notes}</p>
                  )}

                  {/* Peminjam */}
                  <p className="text-sm text-muted-foreground">
                    {r.requester_name}{" "}
                    {r.nim_nip && (
                      <span className="font-mono">· {r.nim_nip}</span>
                    )}
                  </p>

                  {/* Kategori */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Kategori:
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        r.category === "event_kegiatan"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {formatCategory(r.category)}
                    </span>
                  </div>

                  {/* Proposal */}
                  {r.category === "event_kegiatan" && r.attachment_url && (
                    <a
                      href={`${API_URL}${r.attachment_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <FileText className="size-3.5 text-muted-foreground" />
                      {r.attachment_name ?? "Lihat Proposal"}
                      <ExternalLink className="size-3 text-muted-foreground" />
                    </a>
                  )}

                  {/* Tanggal */}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Pinjam {formatDate(r.borrow_date)} → Kembali{" "}
                    {formatDate(r.return_deadline)}
                  </p>
                </div>

                {/* Tombol aksi */}
                <div className="flex gap-2 shrink-0">
                  <RejectDialog
                    loanId={r.id}
                    onConfirm={(reason) => decide(r.id, "rejected", reason)}
                    disabled={loading}
                  />
                  <Button
                    variant="brand"
                    onClick={() => decide(r.id, "approved")}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckSquare className="size-4" />
                    )}{" "}
                    Setujui
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RejectDialog({
  loanId,
  onConfirm,
  disabled,
}: {
  loanId: string;
  onConfirm: (r: string) => void;
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
            Sertakan alasan penolakan untuk transparansi kepada peminjam.
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
