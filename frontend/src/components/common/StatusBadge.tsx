import { cn } from "../../lib/utils";

export type LoanStatus =
  | "pending_dosen"
  | "pending_admin"
  | "approved"
  | "picked_up"
  | "returned"
  | "rejected"
  | "overdue";

const map: Record<LoanStatus, { label: string; className: string }> = {
  pending_dosen: {
    label: "Menunggu Kaprodi", // ✅ update label
    className: "bg-warning/15 text-warning-foreground border-warning/40",
  },
  pending_admin: {
    label: "Menunggu Admin",
    className: "bg-warning/15 text-warning-foreground border-warning/40",
  },
  approved: {
    label: "Disetujui",
    className: "bg-info/15 text-info border-info/40",
  },
  picked_up: {
    label: "Diambil",
    className: "bg-primary/15 text-primary border-primary/40",
  },
  returned: {
    label: "Selesai",
    className: "bg-success/15 text-success border-success/40",
  },
  rejected: {
    label: "Ditolak",
    className: "bg-destructive/15 text-destructive border-destructive/40",
  },
  overdue: {
    label: "Terlambat",
    className: "bg-destructive/15 text-destructive border-destructive/40",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: LoanStatus;
  className?: string;
}) {
  const m = map[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        m.className,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {m.label}
    </span>
  );
}
