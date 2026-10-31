"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import { ApiError } from "@/lib/api-client";
import { METALS, type Metal } from "@/lib/metals";
import { setMetalRateSchema, type SetMetalRateInput } from "@/schemas/metal-rate.schema";
import { useMetalPurities, type MetalPurity } from "@/features/settings/hooks/useMetalPurities";
import { useSetMetalRate } from "@/features/settings/hooks/useSetMetalRate";

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

// Opened from a row's edit icon, pre-filled with that row's current rate.
// Metal and purity are fixed from the clicked row, not editable here. The
// parent renders this keyed by `editTarget?.id`, so switching rows (or
// closing, which cycles the key through "none") remounts it fresh rather
// than needing an effect to reset form/error state between targets.
function EditRateDialog({ purity, onClose }: { purity: MetalPurity | null; onClose: () => void }) {
  const setRate = useSetMetalRate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SetMetalRateInput>({
    resolver: zodResolver(setMetalRateSchema),
    defaultValues: {
      metal: (purity?.metal as Metal) ?? METALS[0],
      purity: purity?.purity ?? "",
      rate_per_gram: purity?.rate_per_gram ?? 0,
      purchase_rate_per_gram: purity?.purchase_rate_per_gram ?? 0,
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setRate.mutate(values, {
      onSuccess: () => {
        toast.success(`${values.metal} ${values.purity} rate updated`);
        onClose();
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          if (error.fields) {
            for (const [field, message] of Object.entries(error.fields)) {
              setError(field as keyof SetMetalRateInput, { message });
            }
            return;
          }
          setFormError(error.message);
          return;
        }
        setFormError("Something went wrong. Please try again.");
      },
    });
  });

  return (
    <Dialog
      open={!!purity}
      onClose={onClose}
      title={purity ? `Edit Rate - ${purity.metal} ${purity.purity}` : "Edit Rate"}
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="edit-rate-value">Sell Rate per gram (₹)</Label>
            <Input
              id="edit-rate-value"
              type="number"
              step="0.01"
              min="0"
              {...register("rate_per_gram", { valueAsNumber: true })}
            />
            {errors.rate_per_gram ? (
              <p className="mt-1.5 text-xs text-destructive">{errors.rate_per_gram.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="edit-purchase-rate-value">Purchase Rate per gram (₹)</Label>
            <Input
              id="edit-purchase-rate-value"
              type="number"
              step="0.01"
              min="0"
              {...register("purchase_rate_per_gram", { valueAsNumber: true })}
            />
            {errors.purchase_rate_per_gram ? (
              <p className="mt-1.5 text-xs text-destructive">{errors.purchase_rate_per_gram.message}</p>
            ) : null}
          </div>
        </div>

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={setRate.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={setRate.isPending}>
            {setRate.isPending ? "Saving…" : "Save Rate"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function MetalRatesTable() {
  const { data, isLoading, isError, error } = useMetalPurities();
  const [editTarget, setEditTarget] = useState<MetalPurity | null>(null);

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
        cellRendererParams: { onEdit: setEditTarget },
        sortable: false,
        filter: false,
      },
    ],
    [],
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

      <EditRateDialog key={editTarget?.id ?? "none"} purity={editTarget} onClose={() => setEditTarget(null)} />
    </div>
  );
}
