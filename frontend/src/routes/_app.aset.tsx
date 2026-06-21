import { createFileRoute } from "@tanstack/react-router";
import { Fragment } from "react";
import { useEffect, useMemo, useState } from "react";
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
import {
  Plus,
  Boxes,
  ChevronDown,
  ChevronRight,
  Pencil,
  Search,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { EmptyState } from "../components/common/EmptyState";
import { cn } from "../lib/utils";
import api from "../lib/api";

const CATEGORY_OPTIONS = [
  "Battery",
  "Camera",
  "Lighting",
  "Lightstand",
  "Tripod",
  "Clip On",
  "Speaker",
  "Adaptor",
  "Memory Card",
  "Cable",
  "Others",
];

export const Route = createFileRoute("/_app/aset")({
  component: ManajemenAset,
  head: () => ({ meta: [{ title: "Manajemen Aset · MNP Lab Loan" }] }),
});

interface Asset {
  id: string;
  name: string;
  category: string;
  description: string | null;
  merk: string | null;
  type: string | null;
  no_pr: string | null;
  no_po: string | null;
  kelengkapan: string | null;
  kode_aset: string | null;
  image_url: string | null;
}

interface Unit {
  id: string;
  asset_id: string;
  unit_code: string;
  serial_number: string | null;
  is_available: boolean;
  condition: "good" | "minor" | "major";
  loan_status: "tersedia" | "dipinjam" | "tidak_tersedia";
}

function emptyForm() {
  return {
    kode_aset: "",
    category: "",
    merk: "",
    type: "",
    no_pr: "",
    no_po: "",
    kelengkapan: "",
    units: 1,
    unitSerialNumbers: [""],
  };
}

function ManajemenAset() {
  const { role } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [search, setSearch] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/assets");
      const data = res.data?.data ?? { assets: [], units: [] };
      setAssets((data.assets as Asset[]) ?? []);
      setUnits((data.units as Unit[]) ?? []);
    } catch {
      setAssets([]);
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const byAsset = new Map<
      string,
      { good: number; minor: number; major: number; total: number }
    >();
    units.forEach((u: Unit) => {
      const s = byAsset.get(u.asset_id) ?? {
        good: 0,
        minor: 0,
        major: 0,
        total: 0,
      };
      s.total++;
      if (u.condition === "good") s.good++;
      else if (u.condition === "minor") s.minor++;
      else s.major++;
      byAsset.set(u.asset_id, s);
    });
    return byAsset;
  }, [units]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a: Asset) =>
      [a.merk, a.type, a.category, a.no_pr, a.kode_aset, a.name]
        .filter(Boolean)
        .some((v) => v && v.toLowerCase().includes(q)),
    );
  }, [assets, search]);

  if (role !== "admin")
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Hanya admin yang dapat mengakses halaman ini.
      </div>
    );

  const addAsset = async () => {
    const num = form.kode_aset.replace(/\D/g, "");
    if (!num || !form.category || !form.merk)
      return toast.error("Kode (nomor), Kategori, Merk wajib diisi");

    try {
      await api.post("/api/assets", {
        kode_aset_num: num,
        category: form.category,
        merk: form.merk,
        type: form.type || null,
        no_pr: form.no_pr || null,
        no_po: form.no_po || null,
        kelengkapan: form.kelengkapan || null,
        units: form.units,
        unitSerialNumbers: form.unitSerialNumbers.filter(Boolean),
      });
      toast.success("Aset berhasil ditambahkan");
      setOpenAdd(false);
      setForm(emptyForm());
      void load();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Gagal menambah aset");
    }
  };

  const toggle = (id: string) => {
    setExpanded((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleUnitsChange = (newCount: number) => {
    setForm((prev) => ({
      ...prev,
      units: newCount,
      unitSerialNumbers: Array(newCount)
        .fill("")
        .map((_, i) => prev.unitSerialNumbers[i] || ""),
    }));
  };

  return (
    <>
      <PageHeader
        title="Manajemen Aset"
        description="Kelola aset dan unit lab."
        actions={
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button variant="brand">
                <Plus className="size-4" /> Tambah Aset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tambah Aset Baru</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Kode Aset">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      MNP/IPRO/
                    </span>
                    <Input
                      value={form.kode_aset}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          kode_aset: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      placeholder="0005"
                      inputMode="numeric"
                    />
                  </div>
                </Field>
                <Field label="Kategori">
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((cat: string) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Merk">
                  <Input
                    value={form.merk}
                    onChange={(e) => setForm({ ...form, merk: e.target.value })}
                    placeholder="Sony"
                  />
                </Field>
                <Field label="Type">
                  <Input
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    placeholder="A7 III"
                  />
                </Field>
                <Field label="NO.PR">
                  <Input
                    value={form.no_pr}
                    onChange={(e) =>
                      setForm({ ...form, no_pr: e.target.value })
                    }
                    placeholder="PR-2024-001"
                  />
                </Field>
                <Field label="No. PO">
                  <Input
                    value={form.no_po}
                    onChange={(e) =>
                      setForm({ ...form, no_po: e.target.value })
                    }
                    placeholder="PO-2024-001"
                  />
                </Field>
                <Field label="Jumlah Unit">
                  <Input
                    type="number"
                    min={1}
                    value={form.units}
                    onChange={(e) => handleUnitsChange(Number(e.target.value))}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Kelengkapan">
                    <Textarea
                      rows={2}
                      value={form.kelengkapan}
                      onChange={(e) =>
                        setForm({ ...form, kelengkapan: e.target.value })
                      }
                    />
                  </Field>
                </div>

                {/* Serial Number inputs untuk setiap unit */}
                {form.units > 0 && (
                  <div className="sm:col-span-2">
                    <div className="border-t pt-3 mt-2">
                      <p className="text-xs font-medium mb-2 text-muted-foreground">
                        Serial Number (S/N) per Unit (opsional, bisa berbeda
                        untuk setiap unit)
                      </p>
                      <div className="space-y-2">
                        {Array.from({ length: form.units }).map((_, i) => (
                          <div key={i} className="flex items-end gap-2">
                            <div className="flex-1">
                              <Label className="text-xs">Unit {i + 1}</Label>
                              <Input
                                value={form.unitSerialNumbers[i] || ""}
                                onChange={(e) => {
                                  const newSNs = [...form.unitSerialNumbers];
                                  newSNs[i] = e.target.value;
                                  setForm({
                                    ...form,
                                    unitSerialNumbers: newSNs,
                                  });
                                }}
                                placeholder={`Misal: S01-6224846-I`}
                                className="text-xs"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenAdd(false)}>
                  Batal
                </Button>
                <Button variant="brand" onClick={addAsset}>
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mt-6 mb-3 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari merk, type, kategori, NO.PR, kode…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Memuat data aset…
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Boxes}
            title="Belum ada aset"
            description="Tambahkan aset pertama Anda."
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-(--shadow-card)">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3">No</th>
                <th className="px-3 py-3">Merk</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Kategori</th>
                <th className="px-3 py-3">NO.PR</th>
                <th className="px-3 py-3">No. PO</th>
                <th className="px-3 py-3">Kelengkapan</th>
                <th className="px-3 py-3 text-success">Stok Baik</th>
                <th className="px-3 py-3 text-warning">Rusak Ringan</th>
                <th className="px-3 py-3 text-destructive">Rusak Berat</th>
                <th className="px-3 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a: Asset, idx: number) => {
                const s = stats.get(a.id) ?? {
                  good: 0,
                  minor: 0,
                  major: 0,
                  total: 0,
                };
                const isOpen = expanded.has(a.id);
                const aUnits = units.filter((u: Unit) => u.asset_id === a.id);
                return (
                  <Fragment key={a.id}>
                    <tr className="hover:bg-muted/30">
                      <td className="px-3 py-3">
                        <button onClick={() => toggle(a.id)}>
                          {isOpen ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3">{idx + 1}</td>
                      <td className="px-3 py-3 font-medium">{a.merk ?? "—"}</td>
                      <td className="px-3 py-3">{a.type ?? "—"}</td>
                      <td className="px-3 py-3">{a.category}</td>
                      <td className="px-3 py-3 font-mono text-xs">
                        {a.no_pr ?? "—"}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">
                        {a.no_po ?? "—"}
                      </td>
                      <td
                        className="px-3 py-3 max-w-45 truncate"
                        title={a.kelengkapan ?? ""}
                      >
                        {a.kelengkapan ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-success font-medium">
                        {s.good}
                      </td>
                      <td className="px-3 py-3 text-warning font-medium">
                        {s.minor}
                      </td>
                      <td className="px-3 py-3 text-destructive font-medium">
                        {s.major}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost-navy"
                            onClick={() => setEditAsset(a)}
                          >
                            <Pencil className="size-3.5" /> Update
                          </Button>
                          <DeleteAssetButton
                            asset={a}
                            unitsCount={aUnits.length}
                            onDeleted={() => void load()}
                          />
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/20">
                        <td colSpan={12} className="px-6 py-3">
                          <div className="rounded-lg border bg-card">
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr className="border-b">
                                  <th className="px-3 py-2 text-left">
                                    Kode Unit
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    Serial Number
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    Status
                                  </th>
                                  <th className="px-3 py-2 text-left">Fisik</th>
                                  <th className="px-3 py-2 text-left">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {aUnits.map((u: Unit) => (
                                  <tr key={u.id}>
                                    <td className="px-3 py-2 font-mono">
                                      {u.unit_code}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[10px]">
                                      {u.serial_number ?? "—"}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={cn(
                                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                          u.loan_status === "tersedia"
                                            ? "bg-success/15 text-success"
                                            : u.loan_status === "dipinjam"
                                              ? "bg-warning/15 text-warning-foreground"
                                              : "bg-destructive/15 text-destructive",
                                        )}
                                      >
                                        {u.loan_status === "tersedia"
                                          ? "Tersedia"
                                          : u.loan_status === "dipinjam"
                                            ? "Dipinjam"
                                            : "Tidak Tersedia"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={cn(
                                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                          u.condition === "good"
                                            ? "bg-success/15 text-success"
                                            : u.condition === "minor"
                                              ? "bg-warning/15 text-warning-foreground"
                                              : "bg-destructive/15 text-destructive",
                                        )}
                                      >
                                        {u.condition === "good"
                                          ? "Baik"
                                          : u.condition === "minor"
                                            ? "Rusak Ringan"
                                            : "Rusak Berat"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setEditUnit(u)}
                                        >
                                          <Pencil className="size-3" /> Update
                                        </Button>
                                        <DeleteUnitButton
                                          unit={u}
                                          onDeleted={() => void load()}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {aUnits.length === 0 && (
                                  <tr>
                                    <td
                                      colSpan={5}
                                      className="px-3 py-3 text-center text-muted-foreground"
                                    >
                                      Tidak ada unit.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editAsset && (
        <EditAssetDialog
          asset={editAsset}
          onClose={() => {
            setEditAsset(null);
            void load();
          }}
        />
      )}
      {editUnit && (
        <EditUnitDialog
          unit={editUnit}
          onClose={() => {
            setEditUnit(null);
            void load();
          }}
        />
      )}
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function EditAssetDialog({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const initialNum = (asset.kode_aset ?? "")
    .replace(/^MNP\/IPRO\//, "")
    .replace(/\D/g, "");
  const [f, setF] = useState({
    kode_aset: initialNum,
    category: asset.category,
    merk: asset.merk ?? "",
    type: asset.type ?? "",
    no_pr: asset.no_pr ?? "",
    no_po: asset.no_po ?? "",
    kelengkapan: asset.kelengkapan ?? "",
    addUnits: 0,
    additionalSerialNumbers: [""],
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const num = f.kode_aset.replace(/\D/g, "");
    if (!num) return toast.error("Nomor kode aset wajib");

    try {
      setSaving(true);
      await api.patch(`/api/assets/${asset.id}`, {
        kode_aset_num: num,
        category: f.category,
        merk: f.merk,
        type: f.type || null,
        no_pr: f.no_pr || null,
        no_po: f.no_po || null,
        kelengkapan: f.kelengkapan || null,
        addUnits: f.addUnits,
        additionalSerialNumbers: f.additionalSerialNumbers.filter(Boolean),
      });
      toast.success("Aset berhasil diperbarui");
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Gagal memperbarui aset");
    } finally {
      setSaving(false);
    }
  };

  const handleAddUnitsChange = (newCount: number) => {
    setF((prev) => ({
      ...prev,
      addUnits: newCount,
      additionalSerialNumbers: Array(newCount)
        .fill("")
        .map((_, i) => prev.additionalSerialNumbers[i] || ""),
    }));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Aset</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kode Aset">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                MNP/IPRO/
              </span>
              <Input
                value={f.kode_aset}
                onChange={(e) =>
                  setF({ ...f, kode_aset: e.target.value.replace(/\D/g, "") })
                }
                placeholder="0005"
                inputMode="numeric"
              />
            </div>
          </Field>
          <Field label="Kategori">
            <Select
              value={f.category}
              onValueChange={(v) => setF({ ...f, category: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((cat: string) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Merk">
            <Input
              value={f.merk}
              onChange={(e) => setF({ ...f, merk: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <Input
              value={f.type}
              onChange={(e) => setF({ ...f, type: e.target.value })}
            />
          </Field>
          <Field label="NO.PR">
            <Input
              value={f.no_pr}
              onChange={(e) => setF({ ...f, no_pr: e.target.value })}
            />
          </Field>
          <Field label="No. PO">
            <Input
              value={f.no_po}
              onChange={(e) => setF({ ...f, no_po: e.target.value })}
            />
          </Field>
          <Field label="Tambah Unit Baru">
            <Input
              type="number"
              min={0}
              value={f.addUnits}
              onChange={(e) => handleAddUnitsChange(Number(e.target.value))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Kelengkapan">
              <Textarea
                rows={2}
                value={f.kelengkapan}
                onChange={(e) => setF({ ...f, kelengkapan: e.target.value })}
              />
            </Field>
          </div>

          {/* Serial Number inputs untuk unit tambahan */}
          {f.addUnits > 0 && (
            <div className="sm:col-span-2">
              <div className="border-t pt-3 mt-2">
                <p className="text-xs font-medium mb-2 text-muted-foreground">
                  Serial Number (S/N) untuk Unit Baru (opsional, bisa berbeda)
                </p>
                <div className="space-y-2">
                  {Array.from({ length: f.addUnits }).map((_, i) => (
                    <div key={i} className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Unit Baru {i + 1}</Label>
                        <Input
                          value={f.additionalSerialNumbers[i] || ""}
                          onChange={(e) => {
                            const newSNs = [...f.additionalSerialNumbers];
                            newSNs[i] = e.target.value;
                            setF({ ...f, additionalSerialNumbers: newSNs });
                          }}
                          placeholder={`Misal: S01-6224847-J`}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <DeleteAssetButton
            asset={asset}
            unitsCount={0}
            onDeleted={onClose}
            variant="full"
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button variant="brand" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Simpan"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUnitDialog({
  unit,
  onClose,
}: {
  unit: Unit;
  onClose: () => void;
}) {
  const [condition, setCondition] = useState(unit.condition);
  const [serial_number, setSerialNumber] = useState(unit.serial_number || "");
  const [saving, setSaving] = useState(false);

  // OTOMATIS DETERMINE STATUS
  const getAutoStatus = (cond: string): boolean => {
    if (cond === "minor" || cond === "major") {
      return false;
    }
    return true;
  };

  const autoAvailable = getAutoStatus(condition);
  const availableText = autoAvailable ? "Tersedia" : "Tidak Tersedia";
  const statusColor = autoAvailable ? "text-success" : "text-destructive";

  const save = async () => {
    try {
      setSaving(true);
      await api.patch(`/api/assets/units/${unit.id}`, {
        condition,
        is_available: autoAvailable,
        serial_number: serial_number || null,
      });
      toast.success("Unit berhasil diperbarui");
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Gagal memperbarui unit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Unit · {unit.unit_code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Kondisi Fisik">
            <Select
              value={condition}
              onValueChange={(v) => setCondition(v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Baik</SelectItem>
                <SelectItem value="minor">Rusak Ringan</SelectItem>
                <SelectItem value="major">Rusak Berat</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Serial Number (S/N)">
            <Input
              value={serial_number}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="S01-6224846-I"
            />
          </Field>

          {/* STATUS OTOMATIS - READ ONLY */}
          <Field label="Status (Otomatis)">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md border bg-muted",
                statusColor,
              )}
            >
              <span
                className={cn(
                  "inline-block size-2 rounded-full",
                  autoAvailable ? "bg-success" : "bg-destructive",
                )}
              />
              <span className="font-medium text-sm">{availableText}</span>
            </div>
          </Field>

          {/* LOGIC INFO */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <p className="font-semibold mb-1">Logika Otomatis:</p>
            <ul className="space-y-0.5">
              <li>
                ✓ Kondisi <strong>Baik</strong> → Status{" "}
                <strong>Tersedia</strong>
              </li>
              <li>
                ✗ Kondisi <strong>Rusak Ringan/Berat</strong> → Status{" "}
                <strong>Tidak Tersedia</strong>
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <DeleteUnitButton unit={unit} onDeleted={onClose} variant="full" />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button variant="brand" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Simpan"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAssetButton({
  asset,
  unitsCount,
  onDeleted,
  variant = "icon",
}: {
  asset: Asset;
  unitsCount: number;
  onDeleted: () => void;
  variant?: "icon" | "full";
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.delete(`/api/assets/${asset.id}`);
      toast.success("Aset berhasil dihapus");
      onDeleted();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Gagal menghapus aset");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : (
          <Button variant="destructive" disabled={deleting}>
            <Trash2 className="size-4" /> Hapus Aset
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus aset ini?</AlertDialogTitle>
          <AlertDialogDescription>
            Aset {asset.merk ?? asset.name}{" "}
            {unitsCount > 0 && `beserta ${unitsCount} unit`} akan dihapus
            permanen. Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteUnitButton({
  unit,
  onDeleted,
  variant = "icon",
}: {
  unit: Unit;
  onDeleted: () => void;
  variant?: "icon" | "full";
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.delete(`/api/assets/units/${unit.id}`);
      toast.success("Unit berhasil dihapus");
      onDeleted();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Gagal menghapus unit");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3" />
          </Button>
        ) : (
          <Button variant="destructive" disabled={deleting}>
            <Trash2 className="size-4" /> Hapus Unit
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus unit {unit.unit_code}?</AlertDialogTitle>
          <AlertDialogDescription>
            Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
