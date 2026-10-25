"use client";

import { useMemo } from "react";
import { Pencil } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Button } from "@/components/ui/Button";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import { ApiError } from "@/lib/api-client";
import { METALS } from "@/lib/metals";
import { useMetalPurities, type MetalPurity } from "@/features/settings/hooks/useMetalPurities";

function formatUpdatedAt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function EditCell({ data, onEdit }: ICellRendererParams<MetalPurity> & { onEdit: (purity: MetalPurity) => void }) {
  if (!data) return null;
  return (
    <div className="flex h-full items-center">
      <Button type="button" variant="outline" size="icon" onClick={() => onEdit(data)}>
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function MetalRatesTable({ onEdit }: { onEdit: (purity: MetalPurity) => void }) {
  const { data, isLoading, isError, error } = useMetalPurities();

  const priced = data?.filter((purity) => purity.rate_per_gram !== null) ?? [];
  const groups = METALS.map((metal) => ({
    metal,
    purities: priced.filter((purity) => purity.metal === metal),
  })).filter((group) => group.purities.length > 0);

  const columnDefs = useMemo<ColDef<MetalPurity>[]>(
    () => [
      { field: "purity", headerName: "Purity", width: 100, headerClass: AG_GRID_HEADER_CLASS },
      {
        field: "rate_per_gram",
        headerName: "Sell Rate/g",
        width: 110,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value != null ? `₹${p.value}` : ""),
      },
      {
        field: "purchase_rate_per_gram",
        headerName: "Purchase Rate/g",
        width: 130,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value != null ? `₹${p.value}` : "—"),
      },
      {
        field: "updated_at",
        headerName: "Updated",
        width: 190,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value ? formatUpdatedAt(p.value) : ""),
      },
      {
        headerName: "Action",
        width: 90,
        flex: 1,
        headerClass: `${AG_GRID_HEADER_CLASS} text-right!`,
        cellRenderer: EditCell,
        cellRendererParams: { onEdit },
        sortable: false,
        filter: false,
      },
    ],
    [onEdit],
  );

  return (
    <div className="panel mt-6 p-6">
      <h3 className="font-display text-xl text-foreground">Current Rates</h3>

      {isLoading ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="mt-4 py-6 text-center text-sm text-destructive">
          {error instanceof ApiError ? error.message : "Failed to load rates."}
        </p>
      ) : !data || data.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">
          No purities yet - add one in the Add Purity tab.
        </p>
      ) : groups.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">No rates set yet - set one above.</p>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.metal} className="rounded-lg border border-border p-4">
              <h4 className="font-display text-base text-foreground">{group.metal}</h4>
              <div className="mt-2">
                <AgGridReact<MetalPurity>
                  theme={agGridTheme}
                  defaultColDef={AG_GRID_DEFAULT_COL_DEF}
                  rowData={group.purities}
                  columnDefs={columnDefs}
                  getRowId={(p) => p.data.id}
                  domLayout="autoHeight"
                  suppressCellFocus
                  animateRows={false}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
