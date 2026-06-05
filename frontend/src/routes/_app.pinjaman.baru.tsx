import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getAvailableAssets } from "../services/asset.service";
import { getDosen } from "../services/user.service";
import { createLoan } from "../services/loan.service";

export const Route = createFileRoute("/_app/pinjaman/baru")({
  component: AjukanPinjaman,
  head: () => ({ meta: [{ title: "Ajukan Peminjaman · MNP Lab Loan" }] }),
});

interface AssetOpt {
  asset_id: string;
  name: string;
  category: string;
  merk: string | null;
  type: string | null;
  available_units: number;
}

interface DosenOpt {
  id: string;
  full_name: string;
}

function AjukanPinjaman() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [assets, setAssets] = useState<AssetOpt[]>([]);
  const [dosens, setDosens] = useState<DosenOpt[]>([]);
  const [assetId, setAssetId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<
    "kelas_praktikum" | "event_kegiatan"
  >("kelas_praktikum");
  const [borrow, setBorrow] = useState("");
  const [deadline, setDeadline] = useState("");
  const [dosenId, setDosenId] = useState("");
  const [proposal, setProposal] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [maxQty, setMaxQty] = useState(99);

  useEffect(() => {
    void (async () => {
      try {
        // Ambil aset tersedia (kondisi good & loan_status tersedia)
        const resAssets = await getAvailableAssets();
        setAssets(resAssets.data?.data ?? []);

        // Ambil daftar dosen (hanya untuk mahasiswa)
        if (role === "student") {
          const resDosen = await getDosen();
          setDosens(resDosen);
        }
      } catch {
        setAssets([]);
        setDosens([]);
      }
    })();
  }, [role]);

  // Update max quantity saat pilih aset
  const handleAssetChange = (id: string) => {
    setAssetId(id);
    const found = assets.find((a) => a.asset_id === id);
    const max = found?.available_units ?? 99;
    setMaxQty(max);
    if (quantity > max) setQuantity(max);
  };

  const submit = async () => {
    if (!user) return;

    // Validasi field wajib
    if (!assetId) return toast.error("Pilih aset yang akan dipinjam");
    if (!borrow) return toast.error("Tanggal pinjam wajib diisi");
    if (!deadline) return toast.error("Tanggal kembali wajib diisi");
    if (deadline < borrow)
      return toast.error("Tanggal kembali tidak boleh sebelum tanggal pinjam");
    if (role === "student" && !dosenId)
      return toast.error("Pilih dosen pembimbing");
    if (role === "student" && category === "event_kegiatan" && !proposal)
      return toast.error("Upload proposal kegiatan untuk kategori event");

    setLoading(true);
    try {
      await createLoan(
        {
          asset_id: assetId,
          quantity,
          category,
          borrow_date: borrow,
          return_deadline: deadline,
          dosen_id: role === "student" ? dosenId : null,
          notes: notes || null,
        },
        proposal ?? undefined,
      );
      toast.success("Pengajuan berhasil dikirim!");
      navigate({ to: "/pinjaman" });
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Gagal mengirim pengajuan");
    } finally {
      setLoading(false);
    }
  };

  const getAssetLabel = (a: AssetOpt) => {
    const merk = [a.merk, a.type].filter(Boolean).join(" ");
    return merk || a.name;
  };

  return (
    <>
      <PageHeader
        title="Ajukan Peminjaman"
        description="Isi formulir pengajuan peminjaman aset lab."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* ── Form utama ── */}
        <div className="space-y-5 lg:col-span-2">
          {/* Detail Pinjaman */}
          <div className="rounded-xl border bg-card p-5 shadow-(--shadow-card)">
            <h2 className="font-display font-semibold">1. Detail Pinjaman</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kategori Peminjaman</Label>
                <Select
                  value={category}
                  onValueChange={(v) =>
                    setCategory(v as "kelas_praktikum" | "event_kegiatan")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kelas_praktikum">
                      Kelas / Praktikum
                    </SelectItem>
                    <SelectItem value="event_kegiatan">
                      Event / Kegiatan
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dosen Pembimbing — hanya untuk mahasiswa */}
              {role === "student" && (
                <div className="space-y-2">
                  <Label>
                    Dosen Pembimbing <span className="text-destructive">*</span>
                  </Label>
                  <Select value={dosenId} onValueChange={setDosenId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih dosen" />
                    </SelectTrigger>
                    <SelectContent>
                      {dosens.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  Tanggal Pinjam <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={borrow}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setBorrow(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Tanggal Kembali <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={deadline}
                  min={borrow || new Date().toISOString().split("T")[0]}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Keterangan / Keperluan</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Untuk praktikum sinematografi pertemuan ke-5…"
                />
              </div>
            </div>
          </div>

          {/* Pilih Aset */}
          <div className="rounded-xl border bg-card p-5 shadow-(--shadow-card)">
            <h2 className="font-display font-semibold">
              2. Aset yang Dipinjam
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
              <div className="space-y-2">
                <Label>
                  Pilih Aset <span className="text-destructive">*</span>
                </Label>
                <Select value={assetId} onValueChange={handleAssetChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih aset tersedia" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Tidak ada aset tersedia
                      </SelectItem>
                    ) : (
                      assets.map((a) => (
                        <SelectItem key={a.asset_id} value={a.asset_id}>
                          {getAssetLabel(a)}{" "}
                          <span className="text-muted-foreground">
                            ({a.available_units} unit tersedia)
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxQty}
                  value={quantity}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setQuantity(Math.min(Math.max(1, v), maxQty));
                  }}
                />
                {assetId && (
                  <p className="text-xs text-muted-foreground">
                    Maks. {maxQty} unit
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Upload Proposal — hanya untuk mahasiswa kategori event */}
          {role === "student" && category === "event_kegiatan" && (
            <div className="rounded-xl border bg-card p-5 shadow-(--shadow-card)">
              <h2 className="font-display font-semibold">3. Upload Proposal</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Wajib untuk kategori Event / Kegiatan. Format: PDF, DOC, atau
                DOCX. Maks. 10 MB.
              </p>
              <div className="mt-4 space-y-2">
                <Label>
                  File Proposal <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setProposal(e.target.files?.[0] ?? null)}
                />
                {proposal && (
                  <p className="text-xs text-muted-foreground">
                    File dipilih:{" "}
                    <span className="font-medium">{proposal.name}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar Ringkasan ── */}
        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-5 shadow-(--shadow-card)">
            <h3 className="font-display font-semibold">Ringkasan</h3>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Aset:</span>{" "}
                {assetId
                  ? getAssetLabel(assets.find((a) => a.asset_id === assetId)!)
                  : "Belum dipilih"}
              </p>
              <p>
                <span className="font-medium text-foreground">Jumlah:</span>{" "}
                {quantity} unit
              </p>
              <p>
                <span className="font-medium text-foreground">Kategori:</span>{" "}
                {category === "kelas_praktikum"
                  ? "Kelas / Praktikum"
                  : "Event / Kegiatan"}
              </p>
              {borrow && (
                <p>
                  <span className="font-medium text-foreground">Pinjam:</span>{" "}
                  {borrow}
                </p>
              )}
              {deadline && (
                <p>
                  <span className="font-medium text-foreground">Kembali:</span>{" "}
                  {deadline}
                </p>
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {role === "student"
                ? "Pengajuan akan diteruskan ke dosen pembimbing, lalu ke admin lab."
                : "Pengajuan akan langsung diteruskan ke admin lab."}
            </p>
            <Button
              onClick={submit}
              variant="brand"
              size="lg"
              className="mt-4 w-full"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Kirim Pengajuan"
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
