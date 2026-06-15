import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 sm:flex-row",
        className,
      )}
    >
      <p className="text-xs text-brown">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-warmgrey/60 text-ink transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs tabular-nums text-brown">
          Page {page} of {pageCount}
        </span>
        <button
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-warmgrey/60 text-ink transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
