"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import { useOldJewelleryItems } from "@/features/dashboard/hooks/useOldJewelleryItems";
import type { OldJewelleryItemListRow, OldJewelleryItemStatus } from "@/features/dashboard/hooks/useOldJewelleryItems";
import { ChangeItemStatusDialog } from "@/features/dashboard/components/ChangeItemStatusDialog";

const LIMIT = 20;

const STATUS_FILTER_OPTIONS = [
  { label: "All statuses", value: "" as const },
  { label: "In Shop", value: "IN_SHOP" as const },
  { label: "Disposed", value: "DISPOSED" as const },
  { label: "Melted", value: "MELTED" as const },
];

const STATUS_BADGE: Record<OldJewelleryItemStatus, string> = {
  IN_SHOP: "bg-emerald-ink/10 text-emerald-ink",
  DISPOSED: "bg-destructive/10 text-destructive",
  MELTED: "bg-gold/20 text-gold-foreground",
};

const STATUS_LABEL: Record<OldJewelleryItemStatus, string> = {
  IN_SHOP: "In Shop",
  DISPOSED: "Disposed",
  MELTED: "Melted",
};

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusCell({ data }: ICellRendererParams<OldJewelleryItemListRow>) {
  if (!data) return null;
  return (
    <Badge variant="outline" className={`border-transparent font-medium ${STATUS_BADGE[data.status]}`}>
      {STATUS_LABEL[data.status]}
    </Badge>
  );
}

// Reads the shared Old Jewellery Inventory page's list state (which row is
// being edited) via the outer component's useState, same pattern as
// MakingChargeDialog's caller: this cell renderer only needs to call back
// up with the row data, not own any dialog state itself.
function makeActionsCell(onChangeStatus: (item: OldJewelleryItemListRow) => void) {
  return function ActionsCell({ data }: ICellRendererParams<OldJewelleryItemListRow>) {
    if (!data) return null;
    if (data.status !== "IN_SHOP") {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    return (
      <Button
        type="button"
        variant="outline"
        className="h-8 px-3 text-xs"
        onClick={() => onChangeStatus(data)}
      >
        Change Status
      </Button>
    );
  };
}

export function OldJewelleryInventoryGrid() {
  const router = useRouter();
  const [status, setStatus] = useState<OldJewelleryItemStatus | "">("");
  const [page, setPage] = useState(1);
  const [editingItem, setEditingItem] = useState<OldJewelleryItemListRow | null>(null);

  const [prevStatus, setPrevStatus] = useState(status);
  if (prevStatus !== status) {
    setPrevStatus(status);
    setPage(1);
  }

  const { data, isLoading, isError } = useOldJewelleryItems({
    page,
    limit: LIMIT,
    status: status || undefined,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const columnDefs = useMemo<ColDef<OldJewelleryItemListRow>[]>(
    () => [
      { field: "purchase_no", headerName: "Purchase No", width: 140, headerClass: AG_GRID_HEADER_CLASS },
      { field: "description", headerName: "Description", width: 220, headerClass: AG_GRID_HEADER_CLASS },
      { field: "metal", headerName: "Metal", width: 100, headerClass: AG_GRID_HEADER_CLASS },
      { field: "purity", headerName: "Purity", width: 100, headerClass: AG_GRID_HEADER_CLASS },
      {
        field: "net_wt_g",
        headerName: "Net Wt (g)",
        width: 120,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value != null ? p.value.toFixed(3) : ""),
      },
      {
        field: "final_value",
        headerName: "Value",
        width: 130,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value != null ? formatInr(p.value) : ""),
      },
      {
        headerName: "Status",
        width: 120,
        headerClass: AG_GRID_HEADER_CLASS,
        cellRenderer: StatusCell,
        valueGetter: (p) => p.data?.status,
      },
      {
        headerName: "Action",
        width: 150,
        headerClass: AG_GRID_HEADER_CLASS,
        cellRenderer: makeActionsCell(setEditingItem),
        sortable: false,
        filter: false,
      },
    ],
    [],
  );

  return (
    <div className="panel p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-xl text-foreground">Old Jewellery Inventory</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SelectField
            className="sm:w-48"
            options={STATUS_FILTER_OPTIONS}
            value={STATUS_FILTER_OPTIONS.find((o) => o.value === status) ?? STATUS_FILTER_OPTIONS[0]}
            onChange={(option) => setStatus(option?.value ?? "")}
          />
          {/* Sell-without-buy: a purchase with no linked invoice, see
              docs/old-jewellery-exchange-plan.md's standalone-purchase
              phase. Lives under this same page's route, not a new sidebar
              entry - this grid is the only place old jewellery inventory is
              managed. Button.tsx has no asChild/Slot support, so this is a
              plain onClick navigation rather than a Link-wrapped button. */}
          <Button type="button" variant="outline" onClick={() => router.push("/old-inventory/new")}>
            <Plus className="h-4 w-4" /> New Purchase
          </Button>
        </div>
      </div>

      <div className="mt-5">
        {isLoading && !data ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="py-6 text-center text-sm text-destructive">Failed to load old jewellery items.</div>
        ) : !data || data.data.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No old jewellery items yet.</div>
        ) : (
          <AgGridReact<OldJewelleryItemListRow>
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
          Page {page} of {totalPages} ({total} total)
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {editingItem ? <ChangeItemStatusDialog item={editingItem} onClose={() => setEditingItem(null)} /> : null}
    </div>
  );
}
