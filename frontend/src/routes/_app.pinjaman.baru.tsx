import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../components/ui/select";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import {
  Loader2, AlertCircle, FileText, Plus, Trash2, PackagePlus,
} from "lucide-react";
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

// ── Satu baris aset ───────────────────────────────────────────
interface AssetItem {
  uid: string;
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

function AjukanPinjaman() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [assets, setAssets] = useState<AssetOpt[]>([]);
  const [dosens, setDosens] = useState<DosenOpt[]>([]);
  const [fetching, setFetching] = useState(true);

  // ✅ Multi-aset
  const [items, setItems] = useState<AssetItem[]>([newItem()]);

  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<"kelas_praktikum" | "event_kegiatan">("kelas_praktikum");
  const [borrow, setBorrow] = useState("");
  const [deadline, setDeadline] = useState("");
  const [dosenId, setDosenId] = useState("");
  const [proposal, setProposal] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const needsProposal = role === "student" && category === "event_kegiatan";
  const filledItems = items.filter((i) => i.assetId);
  const isSubmitDisabled = loading || fetching || (needsProposal && !proposal);

  useEffect(() => {
    void (async () => {
      try {
        setFetching(true);
        const resAssets = await getAvailableAssets();
        setAssets(resAssets.data?.data ?? []);
        if (role === "student") {
          const resDosen = await getDosen();
          setDosens(resDosen);
        }
      } catch {
        setAssets([]);
        setDosens([]);
      } finally {
        setFetching(false);
      }
    })();
  }, [role]);

  // ── Item management ──────────────────────────────────────────
  const addItem = () => {
    if (items.length >= assets.length) {
      toast.info("Semua aset yang tersedia sudah dipilih");
      return;
    }
    setItems((prev) => [...prev, newItem()]);
  };

  const removeItem = (uid: string) => {
    if (items.length === 1) { setItems([newItem()]); return; }
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
        i.uid === uid
          ? { ...i, qty: Math.min(Math.max(1, qty), i.maxQty) }
          : i,
      ),
    );
  };

  // ── Helpers ──────────────────────────────────────────────────
  const getAssetLabel = (a: AssetOpt) => {
    const merk = [a.merk, a.type].filter(Boolean).join(" ");
    return merk || a.name;
  };

  const getAssetNameById = (assetId: string) => {
    const found = assets.find((a) => a.asset_id === assetId);
    return found ? getAssetLabel(found) : assetId.slice(0, 8);
  };

  const selectedIds = items.map((i) => i.assetId).filter(Boolean);

  const handleCategoryChange = (v: "kelas_praktikum" | "event_kegiatan") => {
    setCategory(v);
    if (v !== "event_kegiatan") setProposal(null);
  };

  const handleProposalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Hanya file PDF yang diizinkan");
      e.target.value = "";
      return;
    }
    setProposal(file);
  };

  // ── Submit: 1 loan_request per aset ──────────────────────────
  const submit = async () => {
    if (!user) return;

    if (filledItems.length === 0) return toast.error("Pilih minimal 1 aset");
    const uniqueIds = new Set(filledItems.map((i) => i.assetId));
    if (uniqueIds.size !== filledItems.length)
      return toast.error("Aset yang sama tidak boleh dipilih lebih dari sekali");
    if (!borrow) return toast.error("Tanggal pinjam wajib diisi");
    if (!deadline) return toast.error("Tanggal kembali wajib diisi");
    if (deadline < borrow)
      return toast.error("Tanggal kembali tidak boleh sebelum tanggal pinjam");
    if (role === "student" && !dosenId) return toast.error("Pilih dosen pembimbing");
    if (needsProposal && !proposal)
      return toast.error("Upload proposal kegiatan (PDF) wajib untuk kategori Event/Kegiatan");

    setLoading(true);
    setProgress({ current: 0, total: filledItems.length });

    let successCount = 0;
    const errors: string[] = [];

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
            dosen_id: role === "student" ? dosenId : null,
            notes: notes || null,
          },
          proposal ?? undefined,
        );
        successCount++;
      } catch (err: any) {
        errors.push(`${getAssetNameById(item.assetId)}: ${err.response?.data?.message ?? "Gagal"}`);
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
      navigate({ to: "/pinjaman" });
    }
    errors.forEach((e) => toast.error(e));
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

          {/* 1. Detail Pinjaman */}
          <div className="rounded-xl border bg-card p-5 shadow-(--shadow-card)">
            <h2 className="font-display font-semibold">1. Detail Pinjaman</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kategori Peminjaman</Label>
                <Select value={category} onValueChange={handleCategoryChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kelas_praktikum">Kelas / Praktikum</SelectItem>
                    <SelectItem value="event_kegiatan">Event / Kegiatan</SelectItem>
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
                    <SelectTrigger><SelectValue placeholder="Pilih dosen" /></SelectTrigger>
                    <SelectContent>
                      {dosens.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
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

          {/* 2. Aset yang Dipinjam — ✅ Multi-aset */}
          <div className="rounded-xl border bg-card p-5 shadow-(--shadow-card)">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <PackagePlus className="size-4" />
              2. Aset yang Dipinjam
              <span className="text-xs font-normal text-muted-foreground">
                (bisa pilih lebih dari 1)
              </span>
            </h2>

            {fetching ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Memuat aset…
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {items.map((item, idx) => (
                  <div key={item.uid} className="flex items-end gap-2 rounded-lg border bg-muted/30 p-3">
                    <span className="mb-2 text-xs font-medium text-muted-foreground w-5 shrink-0">
                      {idx + 1}.
                    </span>

                    {/* Select Aset */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <Label className="text-xs">Aset</Label>
                      <Select value={item.assetId} onValueChange={(v) => updateAsset(item.uid, v)}>
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
                              const usedElsewhere =
                                selectedIds.includes(a.asset_id) &&
                                a.asset_id !== item.assetId;
                              return (
                                <SelectItem
                                  key={a.asset_id}
                                  value={a.asset_id}
                                  disabled={a.available_units === 0 || usedElsewhere}
                                >
                                  {getAssetLabel(a)}
                                  <span className="text-muted-foreground text-xs ml-1">
                                    ({a.available_units} unit)
                                    {usedElsewhere && " · sudah dipilih"}
                                  </span>
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Qty */}
                    <div className="w-24 shrink-0 space-y-1">
                      <Label className="text-xs">Jumlah</Label>
                      <Input
                        type="number"
                        className="h-9"
                        min={1}
                        max={item.maxQty}
                        value={item.qty}
                        disabled={!item.assetId}
                        onChange={(e) => updateQty(item.uid, Number(e.target.value))}
                      />
                      {item.assetId && (
                        <p className="text-[10px] text-muted-foreground">Maks. {item.maxQty}</p>
                      )}
                    </div>

                    {/* Hapus */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive mb-0.5"
                      onClick={() => removeItem(item.uid)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={addItem}
                  disabled={fetching || assets.length === 0 || items.length >= assets.length}
                >
                  <Plus className="mr-2 size-4" />
                  Tambah Aset Lain
                </Button>
              </div>
            )}
          </div>

          {/* 3. Upload Proposal PDF — hanya student + event */}
          {needsProposal && (
            <div className="rounded-xl border bg-card p-5 shadow-(--shadow-card)">
              <h2 className="font-display font-semibold">3. Upload Proposal Kegiatan</h2>
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>
                  Proposal kegiatan <strong>wajib diupload</strong> dalam format{" "}
                  <strong>PDF</strong> untuk kategori Event / Kegiatan.
                </p>
              </div>
              <div className="mt-4 space-y-2">
                <Label>
                  File Proposal (PDF) <span className="text-destructive">*</span>
                </Label>
                <Input type="file" accept=".pdf" onChange={handleProposalChange} />
                {proposal ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <FileText className="size-4" />
                    <span className="font-medium">{proposal.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(proposal.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Format: PDF · Maks. 10 MB</p>
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

              {/* Aset list */}
              {filledItems.length === 0 ? (
                <p><span className="font-medium text-foreground">Aset:</span> Belum dipilih</p>
              ) : filledItems.length === 1 ? (
                <p>
                  <span className="font-medium text-foreground">Aset:</span>{" "}
                  {getAssetNameById(filledItems[0].assetId)} × {filledItems[0].qty} unit
                </p>
              ) : (
                <div>
                  <p className="font-medium text-foreground mb-1">
                    Aset ({filledItems.length} item):
                  </p>
                  <ul className="space-y-0.5 ml-2">
                    {filledItems.map((i) => (
                      <li key={i.uid} className="text-xs">
                        • {getAssetNameById(i.assetId)} × {i.qty} unit
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p>
                <span className="font-medium text-foreground">Kategori:</span>{" "}
                {category === "kelas_praktikum" ? "Kelas / Praktikum" : "Event / Kegiatan"}
              </p>
              {borrow && (
                <p><span className="font-medium text-foreground">Pinjam:</span> {borrow}</p>
              )}
              {deadline && (
                <p><span className="font-medium text-foreground">Kembali:</span> {deadline}</p>
              )}
              {needsProposal && (
                <p className={proposal ? "text-green-600" : "text-destructive"}>
                  <span className="font-medium">Proposal:</span>{" "}
                  {proposal ? `✅ ${proposal.name}` : "❌ Belum diupload (wajib)"}
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
              disabled={isSubmitDisabled}
              title={needsProposal && !proposal ? "Upload proposal PDF terlebih dahulu" : undefined}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {progress.total > 1
                    ? `Mengirim ${progress.current}/${progress.total}…`
                    : "Mengirim…"}
                </>
              ) : needsProposal && !proposal ? (
                "Upload Proposal Dulu"
              ) : (
                `Kirim Pengajuan${filledItems.length > 1 ? ` (${filledItems.length} aset)` : ""}`
              )}
            </Button>

            {needsProposal && !proposal && (
              <p className="mt-2 text-center text-xs text-destructive">
                Upload proposal PDF untuk mengaktifkan tombol kirim
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}