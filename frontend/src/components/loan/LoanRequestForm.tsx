import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useAuth } from "../../lib/auth";
import { toast } from "sonner";
import { Loader2, Paperclip } from "lucide-react";
import { getAvailableAssets } from "../../services/asset.service";
import { createLoan } from "../../services/loan.service";

interface AssetOpt {
  asset_id: string;
  name: string;
  merk: string | null;
  type: string | null;
  available_units: number;
}

export function LoanRequestForm({
  onCreated,
  footer,
}: {
  onCreated?: () => void;
  footer?: ReactNode;
}) {
  const { user, role } = useAuth();

  const [assets, setAssets] = useState<AssetOpt[]>([]);
  const [assetId, setAssetId] = useState("");
  const [qty, setQty] = useState(1);
  const [maxQty, setMaxQty] = useState(99);
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<
    "kelas_praktikum" | "event_kegiatan"
  >("kelas_praktikum");
  const [borrow, setBorrow] = useState("");
  const [deadline, setDeadline] = useState("");
  const [proposal, setProposal] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setFetching(true);
        const resAssets = await getAvailableAssets();
        const assetData: AssetOpt[] = (resAssets.data?.data ?? []).map(
          (a: any) => ({
            asset_id: a.asset_id,
            name: a.name,
            merk: a.merk ?? null,
            type: a.type ?? null,
            available_units: a.available_units ?? 0,
          }),
        );
        setAssets(assetData);
      } catch {
        setAssets([]);
      } finally {
        setFetching(false);
      }
    })();
  }, [role]);

  const handleAssetChange = (id: string) => {
    setAssetId(id);
    const found = assets.find((a) => a.asset_id === id);
    const max = found?.available_units ?? 99;
    setMaxQty(max);
    if (qty > max) setQty(max);
  };

  const getAssetLabel = (a: AssetOpt) => {
    const parts = [a.merk, a.type].filter(Boolean).join(" ");
    return parts || a.name;
  };

  // Info alur approval berdasarkan role
  const getApprovalInfo = () => {
    if (role === "student")
      return "Pengajuan akan diteruskan ke Kepala Prodi → Admin";
    if (role === "dosen" || role === "staff")
      return "Pengajuan akan langsung diteruskan ke Admin";
    return "";
  };

  const submit = async () => {
    if (!user) return;

    if (!assetId) return toast.error("Pilih aset yang akan dipinjam");
    if (!borrow) return toast.error("Tanggal pinjam wajib diisi");
    if (!deadline) return toast.error("Tanggal kembali wajib diisi");
    if (deadline < borrow)
      return toast.error("Tanggal kembali tidak boleh sebelum tanggal pinjam");

    // Proposal hanya wajib untuk student + event_kegiatan
    if (role === "student" && category === "event_kegiatan" && !proposal)
      return toast.error("Upload proposal kegiatan wajib untuk kategori Event");

    setLoading(true);
    try {
      await createLoan(
        {
          asset_id: assetId,
          quantity: qty,
          category,
          borrow_date: borrow,
          return_deadline: deadline,
          notes: notes || null,
          // ✅ dosen_id dihapus — routing otomatis dari backend
        },
        proposal ?? undefined,
      );

      toast.success("Pengajuan berhasil dikirim!");

      // Reset form
      setAssetId("");
      setQty(1);
      setMaxQty(99);
      setNotes("");
      setBorrow("");
      setDeadline("");
      setProposal(null);
      setCategory("kelas_praktikum");

      onCreated?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Gagal mengirim pengajuan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Pilih Aset */}
        <div className="space-y-2 sm:col-span-2">
          <Label>
            Pilih Aset <span className="text-destructive">*</span>
          </Label>
          {fetching ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Memuat aset…
            </div>
          ) : (
            <Select value={assetId} onValueChange={handleAssetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih aset tersedia" />
              </SelectTrigger>
              <SelectContent>
                {assets.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Tidak ada aset tersedia saat ini
                  </div>
                ) : (
                  assets.map((a) => (
                    <SelectItem
                      key={a.asset_id}
                      value={a.asset_id}
                      disabled={a.available_units === 0}
                      className="group"
                    >
                      <span className="flex items-center gap-1">
                        <span>{getAssetLabel(a)}</span>
                        <span className="text-muted-foreground group-data-highlighted:text-white">
                          ({a.available_units} unit tersedia)
                        </span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Jumlah */}
        <div className="space-y-2">
          <Label>
            Jumlah <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            onChange={(e) => {
              const v = Number(e.target.value);
              setQty(Math.min(Math.max(1, v), maxQty));
            }}
          />
          {assetId && (
            <p className="text-xs text-muted-foreground">Maks. {maxQty} unit</p>
          )}
        </div>

        {/* Kategori */}
        <div className="space-y-2">
          <Label>
            Kategori <span className="text-destructive">*</span>
          </Label>
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
              <SelectItem value="kelas_praktikum">Kelas / Praktikum</SelectItem>
              <SelectItem value="event_kegiatan">Event / Kegiatan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tanggal Pinjam */}
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

        {/* Tanggal Kembali */}
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

        {/* Upload Proposal — student + event saja */}
        {role === "student" && category === "event_kegiatan" && (
          <div className="space-y-2 sm:col-span-2">
            <Label className="flex items-center gap-2">
              <Paperclip className="size-4" />
              Upload Proposal Kegiatan{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setProposal(e.target.files?.[0] ?? null)}
            />
            {proposal && (
              <p className="text-xs text-muted-foreground">
                File: <span className="font-medium">{proposal.name}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Format: PDF, DOC, DOCX · Maks. 10 MB
            </p>
          </div>
        )}

        {/* Keterangan */}
        <div className="space-y-2 sm:col-span-2">
          <Label>Keterangan</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Tujuan / keperluan peminjaman…"
          />
        </div>
      </div>

      {/* Info alur approval */}
      {getApprovalInfo() && (
        <div className="rounded-sm bg-blue-500/10 border border-blue-500/20 p-2.5">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            📋 <strong>Alur pengajuan:</strong> {getApprovalInfo()}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {footer}
        <Button variant="brand" onClick={submit} disabled={loading || fetching}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Kirim Pengajuan"
          )}
        </Button>
      </div>
    </div>
  );
}
