import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Boxes,
  AlertCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · MNP Lab Loan" }] }),
});

interface LoanRequest {
  id: string;
  requester_id: string;
  asset_id: string;
  quantity: number;
  category: string;
  status: string;
  borrow_date: string;
  return_deadline: string;
  created_at: string;
  asset_name: string;
  requester_name: string;
}

interface Asset {
  id: string;
  name: string;
}

function Dashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState({
    totalAsset: 0,
    stokMenipis: 0,
  });
  const [recentLoans, setRecentLoans] = useState<LoanRequest[]>([]);
  const [overdue, setOverdue] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [loading, setLoading] = useState(false);

  // ✅ Helper: Calculate hours elapsed since created_at
  const calculateHoursElapsed = (createdAt: string): number => {
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);

      // Get asset stats
      const statsRes = await api.get("/api/assets/stats");
      setStats(statsRes.data?.data ?? { totalAsset: 0, stokMenipis: 0 });

      // Get all loans untuk dashboard
      const loansRes = await api.get("/api/loans?status=all");
      const allLoans = loansRes.data?.data ?? [];

      // ✅ FILTER: Hanya tampilkan peminjaman dari jam 12 malam (00:00) hingga sekarang (WIB)
      // Logic: jika borrow_date < hari ini, jangan tampilkan di dashboard
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set ke jam 00:00 WIB hari ini

      const todayLoans = allLoans.filter((loan: LoanRequest) => {
        const borrowDate = new Date(loan.borrow_date);
        // Hanya tampilkan jika borrow_date adalah hari ini atau nanti
        return borrowDate >= today;
      });

      // ✅ Filter untuk "Peminjaman Terbaru" - 24 hour filter dari created_at
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const relevantStatuses = [
        "pending",
        "approved_dosen",
        "approved_admin",
        "picked_up",
        "returned",
        "rejected",
        "overdue",
      ];

      const recent = todayLoans
        .filter((l: LoanRequest) => {
          // Include if: status is relevant AND created within 24 hours
          const createdAt = new Date(l.created_at);
          return (
            relevantStatuses.includes(l.status) &&
            createdAt >= twentyFourHoursAgo
          );
        })
        .sort(
          (a: LoanRequest, b: LoanRequest) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 10); // Show top 10

      setRecentLoans(recent);

      // Count overdue
      const overdueCount = todayLoans.filter(
        (l: LoanRequest) => l.status === "overdue",
      ).length;
      setOverdue(overdueCount);

      // Count rejected
      const rejectedCount = allLoans.filter(
        (l: LoanRequest) => l.status === "rejected",
      ).length;
      setRejected(rejectedCount);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      pending: { label: "Menunggu Kaprodi", variant: "outline" },
      approved_dosen: {
        label: "Menunggu Admin",
        variant: "secondary",
      },
      approved_admin: { label: "Disetujui", variant: "default" },
      picked_up: { label: "Diambil", variant: "default" },
      returned: { label: "Selesai", variant: "default" },
      rejected: { label: "Ditolak", variant: "destructive" },
      overdue: { label: "Terlambat", variant: "destructive" },
    };
    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  if (role !== "admin") {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Hanya admin yang dapat mengakses halaman ini.
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan status aset dan peminjaman lab."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Aset */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Aset</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAsset}</div>
            <p className="text-xs text-muted-foreground">
              Jumlah aset yang terdaftar
            </p>
          </CardContent>
        </Card>

        {/* Stok Menipis */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Menipis</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {stats.stokMenipis}
            </div>
            <p className="text-xs text-muted-foreground">
              Aset dengan stok ≤ 1 unit
            </p>
          </CardContent>
        </Card>

        {/* Terlambat */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terlambat</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdue}</div>
            <p className="text-xs text-muted-foreground">
              Peminjaman melewati deadline
            </p>
          </CardContent>
        </Card>

        {/* Ditolak */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ditolak</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {rejected}
            </div>
            <p className="text-xs text-muted-foreground">
              Permintaan yang ditolak
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Peminjaman Terbaru */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Peminjaman Terbaru</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  ⏰ Menampilkan peminjaman dalam 24 jam terakhir sejak dibuat
                </p>
              </div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Memuat data...
              </div>
            ) : recentLoans.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Tidak ada peminjaman dalam 24 jam terakhir
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-semibold">
                        Asset
                      </th>
                      <th className="text-left py-2 px-2 font-semibold">
                        Requester
                      </th>
                      <th className="text-left py-2 px-2 font-semibold">
                        Status
                      </th>
                      <th className="text-left py-2 px-2 font-semibold">
                        Batas Waktu
                      </th>
                      <th className="text-center py-2 px-2 font-semibold">
                        Jam Ke-
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLoans.map((loan: LoanRequest) => (
                      <tr
                        key={loan.id}
                        className="border-b hover:bg-muted/50 transition"
                      >
                        <td className="py-2 px-2 truncate">
                          {loan.asset_name || "—"}
                        </td>
                        <td className="py-2 px-2 truncate text-muted-foreground">
                          {loan.requester_name || "—"}
                        </td>
                        <td className="py-2 px-2">
                          {getStatusBadge(loan.status)}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">
                          {new Date(loan.return_deadline).toLocaleDateString(
                            "id-ID",
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-medium">
                          {calculateHoursElapsed(loan.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
