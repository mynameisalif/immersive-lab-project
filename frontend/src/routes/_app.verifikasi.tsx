import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { ShieldCheck, Search, Loader2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import api from "../lib/api";

export const Route = createFileRoute("/_app/verifikasi")({
  component: Verifikasi,
  head: () => ({ meta: [{ title: "Verifikasi NIM/NIP · MNP Lab Loan" }] }),
});

interface Profile {
  id: string;
  full_name: string;
  email: string;
  nim_nip: string | null;
  is_blocked: boolean;
  role?: string;
}

function Verifikasi() {
  const { role } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const res = await api.get("/api/users");
        const data: Profile[] = (res.data?.data ?? []).map((u: any) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          nim_nip: u.nim_nip ?? null,
          is_blocked: u.is_blocked ?? false,
          role: u.role,
        }));
        setResults(data);
      } catch (err) {
        console.error("Gagal load users:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Guard: hanya admin
  if (role !== "admin")
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Hanya admin yang dapat mengakses halaman ini.
      </div>
    );

  const updateNim = async (id: string) => {
    const value = editing[id]?.trim();
    if (!value) return toast.error("NIM/NIP tidak boleh kosong");

    try {
      setSaving((s) => ({ ...s, [id]: true }));
      await api.patch(`/api/users/${id}`, { nim_nip: value });
      toast.success("NIM/NIP berhasil diperbarui");
      setResults((r) =>
        r.map((p) => (p.id === id ? { ...p, nim_nip: value } : p)),
      );
      setEditing((e) => {
        const newEditing = { ...e };
        delete newEditing[id];
        return newEditing;
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Gagal memperbarui NIM/NIP");
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  const filtered = results.filter(
    (p) =>
      !q ||
      p.full_name.toLowerCase().includes(q.toLowerCase()) ||
      p.email.toLowerCase().includes(q.toLowerCase()) ||
      (p.nim_nip ?? "").includes(q),
  );

  return (
    <>
      <PageHeader
        title="Verifikasi NIM / NIP"
        description="Verifikasi manual identitas pengguna oleh admin."
      />

      {/* Search */}
      <div className="relative mt-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / email / NIM"
          className="h-10 pl-9"
        />
      </div>

      {/* Daftar user */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            Memuat data pengguna…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            Tidak ada data pengguna.
          </div>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border bg-card p-4 shadow-(--shadow-card)"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                  {p.role && (
                    <p className="text-xs capitalize text-muted-foreground">
                      Role: {p.role}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {p.nim_nip ? (
                    <Badge variant="outline" className="font-mono">
                      <ShieldCheck className="mr-1 size-3" />
                      {p.nim_nip}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Belum diverifikasi</Badge>
                  )}
                  {p.is_blocked && <Badge variant="destructive">Dikunci</Badge>}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">NIM / NIP</Label>
                  <Input
                    className="font-mono"
                    value={editing[p.id] ?? p.nim_nip ?? ""}
                    onChange={(e) =>
                      setEditing((s) => ({ ...s, [p.id]: e.target.value }))
                    }
                    placeholder="Contoh: 21081010999"
                  />
                </div>
                <Button
                  variant="brand"
                  onClick={() => updateNim(p.id)}
                  disabled={saving[p.id] ?? false}
                >
                  {saving[p.id] ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Simpan"
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
