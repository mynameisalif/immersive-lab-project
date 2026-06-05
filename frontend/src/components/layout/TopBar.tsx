import { Bell, Search, Menu, LogOut, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { BrandLogo } from "../common/BrandLogo";
import { useAuth } from "../../lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { getNotifications, markNotifRead } from "../../services/user.service";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../../lib/utils";

interface Notif {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const loadNotifs = async () => {
    try {
      const res = await getNotifications();
      // res.data = { data: [...] } dari backend kita
      // bukan array langsung
      setNotifs(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setNotifs([]);
      console.error("getNotifications error");
    }
  };

  useEffect(() => {
    if (profile) void loadNotifs();
  }, [profile]);

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  const openMessage = async (id: string) => {
    try {
      await markNotifRead(id);
      setNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch {}
    setOpen(false);
    navigate({ to: "/pesan" });
  };

  // Format tanggal dengan cara yang konsisten (fix hydration)
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const initials = (profile?.full_name || profile?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const truncate = (s: string, n = 80) =>
    s.length > n ? s.slice(0, n) + "…" : s;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Buka menu"
        onClick={onMenuClick}
      >
        <Menu className="size-5" />
      </Button>
      <div className="lg:hidden">
        <BrandLogo variant="dark" />
      </div>

      <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:flex-1">
        <div className="relative hidden max-w-md flex-1 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Cari aset, peminjaman…" className="h-10 pl-9" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* ── Notifikasi ── */}
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) void loadNotifs();
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifikasi"
              className="relative"
            >
              <Bell className="size-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-360px p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="font-display font-semibold">Notifikasi</p>
              <button
                className="text-xs font-semibold text-accent hover:underline"
                onClick={() => {
                  setOpen(false);
                  navigate({ to: "/pesan" });
                }}
              >
                Lihat semua
              </button>
            </div>
            <div className="max-h-380px overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <MessageSquare className="size-8 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">
                    Belum ada notifikasi
                  </p>
                </div>
              ) : (
                <ul className="divide-y">
                  {notifs.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => openMessage(n.id)}
                        className={cn(
                          "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                          !n.is_read && "bg-accent/5",
                        )}
                      >
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <MessageSquare className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {n.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {truncate(n.message)}
                          </p>
                          {/* Fix hydration: gunakan format manual, bukan toLocaleString */}
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {formatDate(n.created_at)}
                          </p>
                        </div>
                        {!n.is_read && (
                          <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* ── User Dropdown ── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full border bg-card pl-1 pr-3 py-1 transition-colors hover:bg-muted">
              <div className="flex size-7 items-center justify-center rounded-full bg-linear-to-br from-accent to-primary font-display text-xs font-bold text-primary-foreground">
                {initials}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-xs font-semibold text-foreground">
                  {profile?.full_name || "Pengguna"}
                </p>
                <p className="text-[10px] capitalize text-muted-foreground">
                  {role ?? "—"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="font-semibold">
                {profile?.full_name || "Pengguna"}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {profile?.email || ""}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 size-4" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
