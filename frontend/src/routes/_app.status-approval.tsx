import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { StatusBadge, type LoanStatus } from "../components/common/StatusBadge";
import { useAuth } from "../lib/auth";
import { ListChecks } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { getLoans } from "../services/loan.service";

export const Route = createFileRoute("/_app/status-approval")({
  component: StatusApproval,
  head: () => ({ meta: [{ title: "Status Approval · MNP Lab Loan" }] }),
});

interface Row {
  id: string;
  status: string;
  notes: string;
  asset_name: string;
  merk: string | null;
  type: string | null;
  borrow_date: string;
  return_deadline: string;
  reject_reason: string | null;
  created_at: string;
}

// Mapping status backend → LoanStatus Lovable (untuk StatusBadge & Timeline)
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
  return (map[s] ?? s) as LoanStatus;
};

const formatDate = (d: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
};

function StatusApproval() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        setLoading(true);
        const res = await getLoans();
        const data = res.data?.data ?? [];
        const list: Row[] = data.map((r: any) => ({
          id: r.id,
          status: r.status,
          notes: r.notes ?? r.purpose ?? "",
          asset_name: r.asset_name ?? "—",
          merk: r.merk ?? null,
          type: r.type ?? null,
          borrow_date: r.borrow_date,
          return_deadline: r.return_deadline,
          reject_reason: r.reject_reason ?? null,
          created_at: r.created_at,
        }));
        // Urutkan terbaru di atas
        list.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setRows(list);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const getMerkLabel = (r: Row) => {
    const parts = [r.merk, r.type].filter(Boolean).join(" ");
    return parts || r.asset_name || "—";
  };

  return (
    <>
      <PageHeader
        title="Status Approval"
        description="Pantau status persetujuan setiap pengajuan Anda."
      />

      {loading ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Memuat data…
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={ListChecks}
            title="Belum ada pengajuan"
            description="Buat pengajuan dari halaman Peminjaman."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((r) => {
            const mappedStatus = mapStatus(r.status);
            return (
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
                      <StatusBadge status={mappedStatus} />
                    </div>

                    {/* Nama Aset */}
                    <h3 className="mt-1 font-display font-semibold">
                      {getMerkLabel(r)}
                    </h3>

                    {/* Keterangan */}
                    {r.notes && (
                      <p className="text-sm text-muted-foreground">{r.notes}</p>
                    )}

                    {/* Tanggal */}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pinjam {formatDate(r.borrow_date)} → Kembali{" "}
                      {formatDate(r.return_deadline)}
                    </p>

                    {/* Alasan ditolak */}
                    {r.reject_reason && (
                      <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        <strong>Alasan ditolak:</strong> {r.reject_reason}
                      </p>
                    )}
                  </div>

                  {/* Timeline */}
                  <Timeline status={mappedStatus} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Timeline({ status }: { status: LoanStatus }) {
  const steps = [
    { key: "pending_dosen", label: "Dosen" },
    { key: "pending_admin", label: "Admin" },
    { key: "approved", label: "Disetujui" },
    { key: "picked_up", label: "Diambil" },
    { key: "returned", label: "Selesai" },
  ];
  const order = [
    "pending_dosen",
    "pending_admin",
    "approved",
    "picked_up",
    "returned",
  ];

  const isError = status === "rejected" || status === "overdue";
  const current = isError ? -1 : order.indexOf(status);

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      {isError && (
        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
          {status === "rejected" ? "Ditolak" : "Overdue"}
        </span>
      )}
      {!isError &&
        steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div
              className={`size-2 rounded-full ${
                i <= current ? "bg-primary" : "bg-muted"
              }`}
            />
            <span
              className={
                i <= current
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="text-muted-foreground">→</span>
            )}
          </div>
        ))}
    </div>
  );
}
