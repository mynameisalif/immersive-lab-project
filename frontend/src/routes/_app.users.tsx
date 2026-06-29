import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Search, Lock, Unlock, Loader2, UserPlus } from "lucide-react";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
  role: string; // admin | dosen | staff | student
  is_kaprodi: boolean; // ✅ tambah field
}

// ── Label helpers ─────────────────────────────────────────────
const jenisLabel: Record<string, string> = {
  admin: "Admin",
  dosen: "Dosen",
  staff: "Staff",
  student: "Mahasiswa",
};

const getTipeLabel = (u: U): string => {
  if (u.role === "admin") return "Admin";
  if (u.role === "dosen") return u.is_kaprodi ? "Approver" : "Requester";
  return "Requester";
};

const getTipeBadgeVariant = (u: U) => {
  if (u.role === "admin") return "secondary";
  if (u.role === "dosen" && u.is_kaprodi) return "default";
  return "outline";
};

// ── Initial form state ────────────────────────────────────────
const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  nim_nip: "",
  role: "" as string,
  tipe: "requester" as "requester" | "approver",
};

function UsersPage() {
  const { role } = useAuth();
  const [rows, setRows] = useState<U[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  // ── Dialog state ──────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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
          role: u.role ?? "student",
          is_kaprodi: u.is_kaprodi ?? false,
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

  // ── Toggle block/unblock ──────────────────────────────────
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

  // ── Tambah Pengguna ───────────────────────────────────────
  const handleAddUser = async () => {
    // Validasi semua field wajib
    if (!form.full_name.trim()) return toast.error("Nama wajib diisi");
    if (!form.email.trim()) return toast.error("Email wajib diisi");
    if (!form.password.trim()) return toast.error("Password wajib diisi");
    if (!form.nim_nip.trim()) return toast.error("NIM/NIP wajib diisi");
    if (!form.role) return toast.error("Role wajib dipilih");

    try {
      setSaving(true);

      // Step 1: Register user baru
      const res = await api.post("/api/auth/register", {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        nim_nip: form.nim_nip.trim(),
        role: form.role,
      });

      const newUserId = res.data?.data?.id ?? res.data?.id;

      // Step 2: Jika dosen approver, set is_kaprodi = true
      if (form.role === "dosen" && form.tipe === "approver" && newUserId) {
        await api.patch(`/api/users/${newUserId}`, { is_kaprodi: true });
      }

      toast.success(`Pengguna "${form.full_name}" berhasil ditambahkan!`);
      setDialogOpen(false);
      setForm(emptyForm);
      void load();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Gagal menambahkan pengguna");
    } finally {
      setSaving(false);
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
        description="Daftar seluruh pengguna sistem MNP Lab Loan."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="mr-2 size-4" />
            Tambah Pengguna
          </Button>
        }
      />

      {/* Search */}
      <div className="mt-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama, email…"
          className="h-10 pl-9"
        />
      </div>

      {/* Table */}
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
                {/* ✅ Ganti NIM/NIP → Jenis */}
                <th className="px-4 py-3">Jenis</th>
                {/* ✅ Role → Requester / Approver */}
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
                    {/* Jenis: Admin / Dosen / Staff / Mahasiswa */}
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize">
                        {jenisLabel[u.role] ?? u.role}
                      </Badge>
                    </td>
                    {/* Role: Requester / Approver / Admin */}
                    <td className="px-4 py-3">
                      <Badge variant={getTipeBadgeVariant(u) as any}>
                        {getTipeLabel(u)}
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
                            <Unlock className="size-4 mr-1" /> Buka
                          </>
                        ) : (
                          <>
                            <Lock className="size-4 mr-1" /> Kunci
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

      {/* ── Dialog Tambah Pengguna ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setForm(emptyForm);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5" />
              Tambah Pengguna
            </DialogTitle>
            <DialogDescription>Semua field wajib diisi.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nama */}
            <div className="space-y-1.5">
              <Label>
                Nama Lengkap <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Contoh: Dr. Budi Santoso"
                value={form.full_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, full_name: e.target.value }))
                }
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label>
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                type="email"
                placeholder="nama@mnp.ac.id atau nama@student.mnp.ac.id"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label>
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                type="password"
                placeholder="Minimal 8 karakter"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </div>

            {/* NIM/NIP */}
            <div className="space-y-1.5">
              <Label>
                NIM / NIP <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Contoh: 21081010001"
                value={form.nim_nip}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nim_nip: e.target.value }))
                }
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label>
                Jenis Pengguna <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, role: v, tipe: "requester" }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis pengguna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="dosen">Dosen</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="student">Mahasiswa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ✅ Tipe — muncul hanya jika role = dosen */}
            {form.role === "dosen" && (
              <div className="space-y-1.5">
                <Label>
                  Role Dosen <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.tipe}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      tipe: v as "requester" | "approver",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requester">
                      Requester — Dosen biasa (mengajukan peminjaman)
                    </SelectItem>
                    <SelectItem value="approver">
                      Approver — Kaprodi (menyetujui peminjaman mahasiswa)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setForm(emptyForm);
              }}
              disabled={saving}
            >
              Batal
            </Button>
            <Button onClick={handleAddUser} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 size-4" /> Simpan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
