import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  CheckSquare,
  Users,
  BarChart3,
  MessageSquare,
  PackageCheck,
  ArrowLeftRight,
  ListChecks,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { BrandLogo } from "../common/BrandLogo";
import { useAuth } from "../../lib/auth";

type Item = { to: string; label: string; icon: typeof LayoutDashboard };

const studentNav: Item[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pinjaman", label: "Peminjaman", icon: ClipboardList },
  { to: "/status-approval", label: "Status Approval", icon: ListChecks },
  { to: "/pengembalian", label: "Pengembalian", icon: ArrowLeftRight },
  { to: "/pesan", label: "Pesan", icon: MessageSquare },
];

const dosenNav: Item[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/approval", label: "Approval Peminjaman", icon: CheckSquare },
  { to: "/pinjaman", label: "Peminjaman", icon: ClipboardList },
  { to: "/status-approval", label: "Status Approval", icon: ListChecks },
  { to: "/pengembalian", label: "Pengembalian", icon: ArrowLeftRight },
  { to: "/laporan", label: "Laporan Peminjaman", icon: BarChart3 },
  { to: "/pesan", label: "Pesan", icon: MessageSquare },
];

const adminNav: Item[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/aset", label: "Manajemen Aset", icon: Boxes },
  { to: "/pinjaman", label: "Peminjaman", icon: ClipboardList },
  { to: "/approval", label: "Approval Final", icon: CheckSquare },
  { to: "/verifikasi", label: "Verifikasi NIM/NIP", icon: PackageCheck },
  { to: "/users", label: "Pengguna", icon: Users },
  { to: "/pengembalian", label: "Pengembalian", icon: ArrowLeftRight },
  { to: "/laporan", label: "Laporan Peminjaman", icon: BarChart3 },
  { to: "/pesan", label: "Pesan", icon: MessageSquare },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useAuth();
  const nav =
    role === "admin" ? adminNav : role === "dosen" ? dosenNav : studentNav;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <BrandLogo variant="light" />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((item) => {
          const active =
            path === item.to ||
            (item.to !== "/dashboard" && path.startsWith(item.to + "/"));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              {active && (
                <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-brand" />
              )}
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-lg bg-sidebar-accent/40 p-3">
          <p className="text-xs font-semibold capitalize text-sidebar-foreground">
            Role: {role ?? "—"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/70">
            Hubungi admin lab untuk pertanyaan peminjaman.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:w-248px lg:shrink-0 lg:flex-col lg:border-r lg:bg-sidebar lg:text-sidebar-foreground">
      <SidebarNav />
    </aside>
  );
}
