"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Search, Tag as TagIcon, Trash2 } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import { ApiError } from "@/lib/api-client";
import { useDeleteTag } from "@/features/tagging/hooks/useDeleteTag";
import { useTags } from "@/features/tagging/hooks/useTags";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";

const LIMIT = 20;

const STATUS_BADGE: Record<Tag["status"], string> = {
  tagged: "bg-emerald-ink/10 text-emerald-ink",
  sold: "bg-gold/20 text-gold-foreground",
};

type StatusFilter = "all" | Tag["status"];

// Mirrors STATUS_BADGE's colors so the active tab visually matches the same
// status's badge color in the Status column below. Written as full literal
// class strings (not built with template-literal concatenation) because
// Tailwind's scanner only picks up classes that appear verbatim in source.
const STATUS_TABS: { value: StatusFilter; label: string; activeClass: string }[] = [
  { value: "all", label: "All", activeClass: "data-[state=active]:bg-background" },
  {
    value: "tagged",
    label: "Tagged",
    activeClass: "data-[state=active]:bg-emerald-ink/10 data-[state=active]:text-emerald-ink",
  },
  {
    value: "sold",
    label: "Sold",
    activeClass: "data-[state=active]:bg-gold/20 data-[state=active]:text-gold-foreground",
  },
];

function StatusCell({ data }: ICellRendererParams<Tag>) {
  if (!data) return null;
  return (
    <Badge variant="outline" className={`border-transparent font-medium capitalize ${STATUS_BADGE[data.status]}`}>
      {data.status}
    </Badge>
  );
}

// onReprint/onDelete aren't part of ICellRendererParams - passed through
// per-column via colDef.cellRendererParams instead, since they come from
// props/state on TagsTable, not from the row data itself.
function ActionsCell({
  data,
  onReprint,
  onDelete,
}: ICellRendererParams<Tag> & { onReprint: (tag: Tag) => void; onDelete: (tag: Tag) => void }) {
  if (!data) return null;
  return (
    <div className="flex h-full items-center gap-1">
      <Button type="button" variant="outline" size="icon" onClick={() => onReprint(data)} aria-label="Reprint label">
        <Printer className="h-4 w-4" />
      </Button>
      {/* Sold tags can't be deleted (backend enforces this too) - no button
          offered for an action that would just fail with a 409. */}
      {data.status === "tagged" ? (
        <Button type="button" variant="outline" size="icon" onClick={() => onDelete(data)} aria-label="Delete tag">
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

export function TagsTable({
  onReprint,
  onDeleted,
}: {
  onReprint: (tag: Tag) => void;
  // Called after a tag is successfully deleted - lets the parent page clear
  // any state (e.g. a label preview) referencing that tag's code.
  onDeleted?: (code: string) => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("tagged");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const deleteTag = useDeleteTag();

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
    status: status === "all" ? undefined : status,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const rangeStart = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const rangeEnd = Math.min(page * LIMIT, total);

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
      headerName: "Stone Amount",
      flex: 1,
      headerClass: AG_GRID_HEADER_CLASS,
      // "—" for a tag whose Stone Amount was never set (see
      // StoneAmountDialog.tsx) - distinct from an explicitly applied ₹0, so
      // the table reflects the same distinction the stored data now makes.
      valueGetter: (p) =>
        !p.data || p.data.stone_amount_method === "not_set"
          ? "—"
          : `₹${p.data.stone_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      field: "buyer_code",
      headerName: "Buyer Code",
      flex: 1,
      headerClass: AG_GRID_HEADER_CLASS,
      valueFormatter: (p) => (p.value ? p.value : "—"),
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
      cellRenderer: ActionsCell,
      cellRendererParams: { onReprint, onDelete: setDeleteTarget },
      sortable: false,
      filter: false,
    },
  ],
  [onReprint],
);

  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-xl text-foreground">Tags</h3>
        {data ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {total}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or code"
          leadingIcon={<Search className="h-4 w-4" />}
          className="sm:w-64"
        />

        <Tabs value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className={tab.activeClass}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-5">
        {isLoading && !data ? (
          <TableSkeleton rows={6} />
        ) : isError ? (
          <div className="py-6 text-center text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Failed to load tags."}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <TagIcon className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {q || status !== "all" ? "No tags match the current filters." : "No tags yet."}
            </p>
          </div>
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
          {total === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
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

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete tag?">
        <p className="text-sm text-muted-foreground">
          Delete tag <span className="font-medium text-foreground">{deleteTarget?.code}</span>? This can&apos;t be
          undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteTarget(null)}
            disabled={deleteTag.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            disabled={deleteTag.isPending}
            onClick={() => {
              if (!deleteTarget) return;
              const { code } = deleteTarget;
              deleteTag.mutate(code, {
                onSuccess: () => {
                  toast.success(`Tag ${code} deleted`);
                  setDeleteTarget(null);
                  onDeleted?.(code);
                },
                onError: (err) => {
                  toast.error(err instanceof ApiError ? err.message : "Failed to delete tag");
                  setDeleteTarget(null);
                },
              });
            }}
          >
            {deleteTag.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
