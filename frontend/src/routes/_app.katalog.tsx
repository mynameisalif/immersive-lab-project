import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Boxes } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/katalog")({
  component: Katalog,
  head: () => ({ meta: [{ title: "Katalog Aset · MNP Lab Loan" }] }),
});

interface AssetRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  available: number;
  total: number;
}

function Katalog() {
  const { role } = useAuth();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      const { data: a } = await supabase.from("assets").select("*").order("name");
      const { data: u } = await supabase.from("asset_units").select("asset_id,is_available");
      const map = new Map<string, { total: number; available: number }>();
      (u ?? []).forEach((x) => {
        const m = map.get(x.asset_id) ?? { total: 0, available: 0 };
        m.total += 1;
        if (x.is_available) m.available += 1;
        map.set(x.asset_id, m);
      });
      setAssets(
        (a ?? []).map((row) => ({
          ...row,
          ...(map.get(row.id) ?? { total: 0, available: 0 }),
        })),
      );
    })();
  }, []);

  const filtered = assets.filter(
    (a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.category.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Katalog Aset" description="Daftar aset lab yang dapat dipinjam." />
      <div className="mt-4 flex gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / kategori…" className="h-10 pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={Boxes} title="Belum ada aset" description="Admin lab belum menambahkan aset." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]">
              <div className="aspect-[4/3] w-full bg-gradient-to-br from-primary/10 to-accent/10">
                {a.image_url ? (
                  <img src={a.image_url} alt={a.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary/40"><Boxes className="size-12" /></div>
                )}
              </div>
              <div className="p-4">
                <Badge variant="outline" className="text-[10px]">{a.category}</Badge>
                <h3 className="mt-2 font-display font-semibold text-foreground">{a.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.description ?? "—"}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Tersedia <span className="font-semibold text-foreground">{a.available}/{a.total}</span>
                  </span>
                  {role === "student" && (
                    <Button asChild size="sm" variant="brand" disabled={a.available === 0}>
                      <Link to="/pinjaman/baru">Pinjam</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
