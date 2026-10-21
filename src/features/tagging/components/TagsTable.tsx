"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Search } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import { ApiError } from "@/lib/api-client";
import { useTags } from "@/features/tagging/hooks/useTags";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";

const LIMIT = 20;

const STATUS_BADGE: Record<Tag["status"], string> = {
  tagged: "bg-emerald-ink/10 text-emerald-ink",
  sold: "bg-gold/20 text-gold-foreground",
};

function StatusCell({ data }: ICellRendererParams<Tag>) {
  if (!data) return null;
  return (
    <Badge variant="outline" className={`border-transparent font-medium capitalize ${STATUS_BADGE[data.status]}`}>
      {data.status}
    </Badge>
  );
}

// onReprint isn't part of ICellRendererParams - passed through per-column
// via colDef.cellRendererParams instead, since it comes from a prop on
// TagsTable, not from the row data itself.
function ReprintCell({ data, onReprint }: ICellRendererParams<Tag> & { onReprint: (tag: Tag) => void }) {
  if (!data) return null;
  return (
    <div className="flex h-full items-center">
      <Button type="button" variant="outline" size="icon" onClick={() => onReprint(data)}>
        <Printer className="h-4 w-4" />
      </Button>
    </div>
  );
}

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

const columnDefs = useMemo<ColDef<Tag>[]>(
  () => [
    {
      field: "code",
      headerName: "Tag Code",
      flex: 1,
      headerClass: AG_GRID_HEADER_CLASS,
    },
    {
      field: "product_name",
      headerName: "Product",
      flex: 1,
      headerClass: AG_GRID_HEADER_CLASS,
    },
    {
      headerName: "Metal / Purity",
      flex: 1,
      headerClass: AG_GRID_HEADER_CLASS,
      valueGetter: (p) =>
        p.data ? `${p.data.metal} · ${p.data.purity}` : "",
    },
    {
      headerName: "Net Wt",
      flex: 1,
      headerClass: AG_GRID_HEADER_CLASS,
      valueGetter: (p) => (p.data ? `${p.data.net_wt_g}g` : ""),
    },
    {
      headerName: "Status",
      flex: 1,
      headerClass: AG_GRID_HEADER_CLASS,
      cellRenderer: StatusCell,
      valueGetter: (p) => p.data?.status,
    },
    {
      headerName: "Action",
      flex: 1,
      headerClass: `${AG_GRID_HEADER_CLASS}`,
      cellRenderer: ReprintCell,
      cellRendererParams: { onReprint },
      sortable: false,
      filter: false,
    },
  ],
  [onReprint],
);

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

      <div className="mt-5">
        {isLoading && !data ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="py-6 text-center text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Failed to load tags."}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No tags yet.</div>
        ) : (
          <AgGridReact<Tag>
            theme={agGridTheme}
            defaultColDef={AG_GRID_DEFAULT_COL_DEF}
            rowData={data.data}
            columnDefs={columnDefs}
            getRowId={(p) => p.data.id}
            domLayout="autoHeight"
            suppressCellFocus
            animateRows={false}
          />
        )}
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
