"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useTags } from "@/features/tagging/hooks/useTags";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";

const LIMIT = 20;

const STATUS_BADGE: Record<Tag["status"], string> = {
  tagged: "bg-emerald-ink/10 text-emerald-ink",
  sold: "bg-gold/20 text-gold-foreground",
};

export function TagsTable({ onReprint }: { onReprint: (tag: Tag) => void }) {
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "tagged" | "sold">("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when the filters change - adjusted during render (React's
  // recommended pattern for derived state), not in an effect: an effect here
  // would commit the old page's data for one extra frame before resetting.
  const [prevFilters, setPrevFilters] = useState({ q, status });
  if (prevFilters.q !== q || prevFilters.status !== status) {
    setPrevFilters({ q, status });
    setPage(1);
  }

  const { data, isLoading, isError, error } = useTags({
    page,
    limit: LIMIT,
    q: q || undefined,
    status: status || undefined,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="panel p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-xl text-foreground">Tags</h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or code"
            leadingIcon={<Search className="h-4 w-4" />}
            className="sm:w-64"
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | "tagged" | "sold")}
            className="sm:w-36"
          >
            <option value="">All statuses</option>
            <option value="tagged">Tagged</option>
            <option value="sold">Sold</option>
          </Select>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-2 pr-3 font-medium">Code</th>
              <th className="py-2 pr-3 font-medium">Product</th>
              <th className="py-2 pr-3 font-medium">Metal / Purity</th>
              <th className="py-2 pr-3 font-medium">Net Wt</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-destructive">
                  {error instanceof ApiError ? error.message : "Failed to load tags."}
                </td>
              </tr>
            ) : !data || data.data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  No tags yet.
                </td>
              </tr>
            ) : (
              data.data.map((tag) => (
                <tr key={tag.id} className="border-b border-border/60">
                  <td className="py-3 pr-3 font-mono text-xs text-foreground">{tag.code}</td>
                  <td className="py-3 pr-3 text-foreground">{tag.product_name}</td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {tag.metal} · {tag.purity}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">{tag.net_wt_g}g</td>
                  <td className="py-3 pr-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                        STATUS_BADGE[tag.status],
                      )}
                    >
                      {tag.status}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <Button type="button" variant="outline" size="icon" onClick={() => onReprint(tag)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
