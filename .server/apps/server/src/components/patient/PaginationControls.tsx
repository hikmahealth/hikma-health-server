import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination } from "@/lib/server-functions/builders";

type Props = {
  pagination: Pagination;
  onPageChange: (offset: number) => void;
  loading?: boolean;
};

/** Simple prev/next pagination bar with page info. */
export function PaginationControls({ pagination, onPageChange, loading }: Props) {
  const { offset, limit, total, hasMore } = pagination;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = total > 0 ? Math.ceil(total / limit) : 1;
  const hasPrev = offset > 0;

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-sm text-muted-foreground">
        {total > 0
          ? `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`
          : "No results"}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev || loading}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore || loading}
          onClick={() => onPageChange(offset + limit)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Derive page number (1-indexed) from offset + limit. */
export const pageFromOffset = (offset: number, limit: number): number =>
  Math.floor(Math.max(0, offset) / Math.max(1, limit)) + 1;

/** Derive total page count from total items + limit. */
export const totalPages = (total: number, limit: number): number =>
  total > 0 ? Math.ceil(total / Math.max(1, limit)) : 1;

/** Derive the display range string, e.g. "1–10 of 42". */
export const displayRange = (offset: number, limit: number, total: number): string =>
  total > 0
    ? `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`
    : "No results";
