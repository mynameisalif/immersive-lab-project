import { cn } from "../../lib/utils";

export function BrandLogo({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const textClass =
    variant === "light" ? "text-primary-foreground" : "text-primary";
  const subClass =
    variant === "light"
      ? "text-primary-foreground/70"
      : "text-muted-foreground";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-primary shadow-[var(--shadow-elegant)]">
        <div className="absolute inset-1 rounded-md border border-brand/70" />
        <span className="relative font-display text-sm font-bold text-brand">
          M
        </span>
      </div>
      <div className="leading-tight">
        <p
          className={cn(
            "font-display text-sm font-bold tracking-tight",
            textClass,
          )}
        >
          MNP Lab Loan
        </p>
        <p
          className={cn(
            "text-[10px] font-medium uppercase tracking-wider",
            subClass,
          )}
        >
          Asset Management
        </p>
      </div>
    </div>
  );
}
