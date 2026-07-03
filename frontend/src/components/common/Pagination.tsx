import { Button } from "../ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  loading,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="mt-4 flex items-center justify-between text-sm pb-4 mr-4 ml-4">
      <p className="text-muted-foreground ">
        Menampilkan {from}–{to} dari {total} data
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1 || loading}
        >
          <ChevronLeft className="size-4" />
          Prev
        </Button>

        {/* Nomor halaman */}
        <div className="flex gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            // Tampilkan halaman di sekitar halaman aktif
            let p: number;
            if (totalPages <= 5) {
              p = i + 1;
            } else if (page <= 3) {
              p = i + 1;
            } else if (page >= totalPages - 2) {
              p = totalPages - 4 + i;
            } else {
              p = page - 2 + i;
            }
            return (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                className="w-8 p-0"
                onClick={() => onPageChange(p)}
                disabled={loading}
              >
                {p}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages || loading}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
