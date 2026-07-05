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
import {
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  AlertCircle,
  PackagePlus,
} from "lucide-react";
import { getAvailableAssets } from "../../services/asset.service";
import { createLoan, getNextLoanNumber } from "../../services/loan.service";

interface AssetOpt {
  asset_id: string;
  name: string;
  merk: string | null;
  type: string | null;
  available_units: number;
}

// ── Satu baris aset yang dipilih ──────────────────────────────
interface AssetItem {
  uid: string; // unique key per baris
  assetId: string;
  qty: number;
  maxQty: number;
}

const newItem = (): AssetItem => ({
  uid: Math.random().toString(36).slice(2) + Date.now().toString(36),
  assetId: "",
  qty: 1,
  maxQty: 99,
});

export function LoanRequestForm({
  onCreated,
  footer,
}: {
  onCreated?: () => void;
  footer?: ReactNode;
}) {
  const { user, role } = useAuth();

  const [assets, setAssets] = useState<AssetOpt[]>([]);
  const [fetching, setFetching] = useState(true);

  // ✅ Multi-aset: list of AssetItem
  const [items, setItems] = useState<AssetItem[]>([newItem()]);

  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<
    "kelas_praktikum" | "event_kegiatan"
  >("kelas_praktikum");
  const [borrow, setBorrow] = useState("");
  const [deadline, setDeadline] = useState("");
  const [proposal, setProposal] = useState<File | null>(null);

  // Loading state dengan progress
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const needsProposal = role === "student" && category === "event_kegiatan";

  // ── Fetch available assets ────────────────────────────────
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

  // ── Helpers ───────────────────────────────────────────────
  const getAssetLabel = (a: AssetOpt) => {
    const parts = [a.merk, a.type].filter(Boolean).join(" ");
    return parts || a.name;
  };

  const getAssetName = (assetId: string) => {
    const found = assets.find((a) => a.asset_id === assetId);
    return found ? getAssetLabel(found) : assetId.slice(0, 8);
  };

  // ID aset yang sudah dipilih di baris lain (untuk disable di dropdown)
  const selectedAssetIds = items.map((i) => i.assetId).filter(Boolean);

  // ── Item management ───────────────────────────────────────
  const addItem = () => {
    if (items.length >= assets.length) {
      toast.info("Semua aset yang tersedia sudah dipilih");
      return;
    }
    setItems((prev) => [...prev, newItem()]);
  };

  const removeItem = (uid: string) => {
    if (items.length === 1) {
      // Reset baris pertama daripada hapus
      setItems([newItem()]);
      return;
    }
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  const updateAsset = (uid: string, assetId: string) => {
    const found = assets.find((a) => a.asset_id === assetId);
    const maxQty = found?.available_units ?? 99;
    setItems((prev) =>
      prev.map((i) =>
        i.uid === uid
          ? { ...i, assetId, maxQty, qty: Math.min(i.qty, maxQty) }
          : i,
      ),
    );
  };

  const updateQty = (uid: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.uid === uid ? { ...i, qty: Math.min(Math.max(1, qty), i.maxQty) } : i,
      ),
    );
  };

  // ── Proposal change ───────────────────────────────────────
  const handleProposalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Hanya file PDF yang diizinkan");
      e.target.value = "";
      return;
    }
    setProposal(file);
  };

  const getApprovalInfo = () => {
    if (role === "student")
      return "Pengajuan akan diteruskan ke Kepala Prodi → Admin";
    if (role === "dosen" || role === "staff")
      return "Pengajuan akan langsung diteruskan ke Admin";
    return "";
  };

  // ── Reset form ────────────────────────────────────────────
  const resetForm = () => {
    setItems([newItem()]);
    setNotes("");
    setBorrow("");
    setDeadline("");
    setProposal(null);
    setCategory("kelas_praktikum");
  };

  // ── Submit: buat 1 loan_request per aset ─────────────────
  const submit = async () => {
    if (!user) return;

    // Validasi baris aset
    const filledItems = items.filter((i) => i.assetId);
    if (filledItems.length === 0)
      return toast.error("Pilih minimal 1 aset yang akan dipinjam");

    // Cek aset duplikat
    const uniqueIds = new Set(filledItems.map((i) => i.assetId));
    if (uniqueIds.size !== filledItems.length)
      return toast.error(
        "Aset yang sama tidak boleh dipilih lebih dari sekali",
      );

    if (!borrow) return toast.error("Tanggal pinjam wajib diisi");
    if (!deadline) return toast.error("Tanggal kembali wajib diisi");
    if (deadline < borrow)
      return toast.error("Tanggal kembali tidak boleh sebelum tanggal pinjam");

    if (needsProposal && !proposal)
      return toast.error(
        "Upload proposal kegiatan (PDF) wajib untuk kategori Event/Kegiatan",
      );

    setLoading(true);
    setProgress({ current: 0, total: filledItems.length });

    // ✅ NEW: Ambil 1 nomor peminjaman SEKALI di awal, supaya semua
    //    aset dalam submission ini (multi-asset) pakai nomor yang SAMA.
    let loanNumber: string | undefined;
    try {
      const numRes = await getNextLoanNumber();
      loanNumber = numRes.data?.data?.loan_number;
    } catch {
      setLoading(false);
      setProgress({ current: 0, total: 0 });
      toast.error("Gagal membuat nomor peminjaman. Silakan coba lagi.");
      return;
    }

    let successCount = 0;
    const errors: string[] = [];

    // ✅ Buat 1 loan_request per aset — SEMUA pakai loanNumber yang sama
    for (let i = 0; i < filledItems.length; i++) {
      const item = filledItems[i];
      setProgress({ current: i + 1, total: filledItems.length });

      try {
        await createLoan(
          {
            asset_id: item.assetId,
            quantity: item.qty,
            category,
            borrow_date: borrow,
            return_deadline: deadline,
            notes: notes || null,
            loan_number: loanNumber, // ✅ NEW: sama untuk semua aset di batch ini
          },
          proposal ?? undefined,
        );
        successCount++;
      } catch (err: any) {
        const msg = err.response?.data?.message ?? "Gagal mengirim pengajuan";
        errors.push(`${getAssetName(item.assetId)}: ${msg}`);
      }
    }

    setLoading(false);
    setProgress({ current: 0, total: 0 });

    if (successCount > 0) {
      toast.success(
        filledItems.length === 1
          ? "Pengajuan berhasil dikirim!"
          : `${successCount} dari ${filledItems.length} pengajuan berhasil dikirim!`,
      );
      resetForm();
      onCreated?.();
    }

    // Tampilkan error jika ada partial failure
    errors.forEach((e) => toast.error(e));
  };

  const isSubmitDisabled = loading || fetching || (needsProposal && !proposal);

  return (
    <div className="space-y-4">
      {/* ── Detail Peminjaman ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Kategori */}
        <div className="space-y-2">
          <Label>
            Kategori <span className="text-destructive">*</span>
          </Label>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v as "kelas_praktikum" | "event_kegiatan");
              if (v !== "event_kegiatan") setProposal(null);
            }}
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

        {/* Spacer */}
        <div className="hidden sm:block" />

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
      </div>

      {/* ── Pilih Aset (Multi) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <PackagePlus className="size-4" />
            Aset yang Dipinjam <span className="text-destructive">*</span>
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              (bisa pilih lebih dari 1 aset)
            </span>
          </Label>
        </div>

        {fetching ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat aset…
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={item.uid}
                className="flex items-end gap-2 rounded-lg border bg-muted/30 p-3"
              >
                {/* Label nomor baris */}
                <span className="mb-2 text-xs font-medium text-muted-foreground w-5 shrink-0">
                  {idx + 1}.
                </span>

                {/* Select Aset */}
                <div className="flex-1 space-y-1 min-w-0">
                  <Label className="text-xs">Aset</Label>
                  <Select
                    value={item.assetId}
                    onValueChange={(v) => updateAsset(item.uid, v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Pilih aset…" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Tidak ada aset tersedia
                        </div>
                      ) : (
                        assets.map((a) => {
                          // Disable aset yang sudah dipilih di baris lain
                          const usedElsewhere =
                            selectedAssetIds.includes(a.asset_id) &&
                            a.asset_id !== item.assetId;
                          return (
                            <SelectItem
                              key={a.asset_id}
                              value={a.asset_id}
                              disabled={
                                a.available_units === 0 || usedElsewhere
                              }
                            >
                              <span className="flex items-center gap-1">
                                <span>{getAssetLabel(a)}</span>
                                <span className="text-muted-foreground text-xs">
                                  ({a.available_units} unit)
                                  {usedElsewhere && " · sudah dipilih"}
                                </span>
                              </span>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Input Qty */}
                <div className="w-24 shrink-0 space-y-1">
                  <Label className="text-xs">Jumlah</Label>
                  <Input
                    type="number"
                    className="h-9"
                    min={1}
                    max={item.maxQty}
                    value={item.qty}
                    disabled={!item.assetId}
                    onChange={(e) =>
                      updateQty(item.uid, Number(e.target.value))
                    }
                  />
                  {item.assetId && (
                    <p className="text-[10px] text-muted-foreground">
                      Maks. {item.maxQty}
                    </p>
                  )}
                </div>

                {/* Tombol Hapus baris */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive mb-0.5"
                  onClick={() => removeItem(item.uid)}
                  title="Hapus baris ini"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}

            {/* Tombol Tambah Aset */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={addItem}
              disabled={
                fetching || assets.length === 0 || items.length >= assets.length
              }
            >
              <Plus className="mr-2 size-4" />
              Tambah Aset Lain
            </Button>
          </div>
        )}
      </div>

      {/* ── Upload Proposal PDF ── student + event saja */}
      {needsProposal && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>
              Proposal kegiatan <strong>wajib diupload</strong> dalam format{" "}
              <strong>PDF</strong> untuk kategori Event / Kegiatan.
            </p>
          </div>
          <Label className="flex items-center gap-2 text-sm">
            <Paperclip className="size-4" />
            File Proposal (PDF) <span className="text-destructive">*</span>
          </Label>
          <Input type="file" accept=".pdf" onChange={handleProposalChange} />
          {proposal ? (
            <p className="text-xs text-green-600 font-medium">
              ✅ {proposal.name}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Format: PDF · Maks. 10 MB
            </p>
          )}
        </div>
      )}

      {/* ── Keterangan ── */}
      <div className="space-y-2">
        <Label>Keterangan</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Tujuan / keperluan peminjaman…"
        />
      </div>

      {/* ── Info alur approval ── */}
      {getApprovalInfo() && (
        <div className="rounded-sm bg-blue-500/10 border border-blue-500/20 p-2.5">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            📋 <strong>Alur pengajuan:</strong> {getApprovalInfo()}
          </p>
        </div>
      )}

      {/* ── Ringkasan yang akan dikirim ── */}
      {items.some((i) => i.assetId) && (
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">
            Ringkasan: {items.filter((i) => i.assetId).length} aset akan
            diajukan
          </p>
          {items
            .filter((i) => i.assetId)
            .map((i) => (
              <p key={i.uid}>
                • {getAssetName(i.assetId)} × {i.qty} unit
              </p>
            ))}
        </div>
      )}

      {/* ── Submit ── */}
      <div className="flex justify-end gap-2">
        {footer}
        <Button
          variant="brand"
          onClick={submit}
          disabled={isSubmitDisabled}
          title={
            needsProposal && !proposal
              ? "Upload proposal PDF terlebih dahulu"
              : undefined
          }
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {progress.total > 1
                ? `Mengirim ${progress.current}/${progress.total}…`
                : "Mengirim…"}
            </>
          ) : needsProposal && !proposal ? (
            "Upload Proposal Dulu"
          ) : (
            `Kirim Pengajuan${items.filter((i) => i.assetId).length > 1 ? ` (${items.filter((i) => i.assetId).length} aset)` : ""}`
          )}
        </Button>
      </div>
    </div>
  );
}
