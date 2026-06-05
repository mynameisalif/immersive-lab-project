import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Search, Lock, Unlock, Loader2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import api from "../lib/api";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Pengguna · MNP Lab Loan" }] }),
});

interface U {
  id: string;
  full_name: string;
  email: string;
  nim_nip: string | null;
  is_blocked: boolean;
  role?: string;
}

function UsersPage() {
  const { role } = useAuth();
  const [rows, setRows] = useState<U[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/users");
      const data = res.data?.data ?? [];
      setRows(
        data.map((u: any) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          nim_nip: u.nim_nip ?? null,
          is_blocked: u.is_blocked ?? false,
          role: u.role ?? "-",
        })),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (role !== "admin")
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Hanya admin yang dapat mengakses halaman ini.
      </div>
    );

  const toggleBlock = async (u: U) => {
    const next = !u.is_blocked;
    setUpdating((prev) => ({ ...prev, [u.id]: true }));
    try {
      await api.patch(`/api/users/${u.id}/block`, {
        is_blocked: next,
        reason: next ? "Dikunci oleh admin" : null,
      });
      toast.success(
        next ? "Akun berhasil dikunci" : "Akun berhasil diaktifkan",
      );
      void load();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Gagal mengubah status akun");
    } finally {
      setUpdating((prev) => ({ ...prev, [u.id]: false }));
    }
  };

  const filtered = rows.filter(
    (u) =>
      !q ||
      u.full_name.toLowerCase().includes(q.toLowerCase()) ||
      u.email.toLowerCase().includes(q.toLowerCase()) ||
      (u.nim_nip && u.nim_nip.includes(q)),
  );

  return (
    <>
      <PageHeader
        title="Manajemen Pengguna"
        description="Daftar mahasiswa, dosen, dan admin."
      />

      <div className="mt-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama, email, NIM/NIP…"
          className="h-10 pl-9"
        />
      </div>

      {loading ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Memuat data pengguna…
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border bg-card shadow-(--shadow-card)">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">NIM/NIP</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{u.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {u.nim_nip ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize">
                        {u.role ?? "-"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_blocked ? (
                        <Badge variant="destructive">Terkunci</Badge>
                      ) : (
                        <Badge className="bg-success/15 text-success">
                          Aktif
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={u.is_blocked ? "brand" : "outline"}
                        onClick={() => toggleBlock(u)}
                        disabled={updating[u.id] ?? false}
                      >
                        {updating[u.id] ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : u.is_blocked ? (
                          <>
                            <Unlock className="size-4" /> Buka
                          </>
                        ) : (
                          <>
                            <Lock className="size-4" /> Kunci
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
