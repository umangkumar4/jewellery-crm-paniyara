"use client";

import { useCallback, useMemo, useState } from "react";
import { Archive as ArchiveIcon, ArchiveRestore, Check, Pencil, Trash2, X } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, RowClassParams } from "ag-grid-community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import { ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { useMetalPurities, type MetalPurity } from "@/features/settings/hooks/useMetalPurities";
import { useRenamePurity } from "@/features/settings/hooks/useRenamePurity";
import { useSetPurityActive } from "@/features/settings/hooks/useSetPurityActive";
import { useDeletePurity } from "@/features/settings/hooks/useDeletePurity";

interface PurityCellExtra {
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  startRename: (purity: MetalPurity) => void;
  cancelRename: () => void;
  saveRename: (id: string) => void;
  toggleActive: (purity: MetalPurity) => void;
  remove: (purity: MetalPurity) => void;
}

function PurityCell({ data, renamingId, renameValue, setRenameValue, saveRename, cancelRename }: ICellRendererParams<MetalPurity> & PurityCellExtra) {
  if (!data) return null;
  if (renamingId !== data.id) return <span>{data.purity}</span>;
  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={renameValue}
        onChange={(e) => setRenameValue(e.target.value)}
        maxLength={20}
        className="h-9 w-28"
      />
      <button
        type="button"
        onClick={() => saveRename(data.id)}
        className="text-emerald-ink hover:opacity-80"
        aria-label="Save"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={cancelRename}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Cancel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StatusCell({ data }: ICellRendererParams<MetalPurity>) {
  if (!data) return null;
  return (
    <Badge
      variant="outline"
      className={`border-transparent font-medium capitalize ${
        data.active ? "bg-emerald-ink/10 text-emerald-ink" : "bg-muted text-muted-foreground"
      }`}
    >
      {data.active ? "Active" : "Archived"}
    </Badge>
  );
}

function ActionsCell({
  data,
  renamingId,
  startRename,
  toggleActive,
  remove,
}: ICellRendererParams<MetalPurity> & PurityCellExtra) {
  if (!data) return null;
  const isRenaming = renamingId === data.id;
  return (
    <div className="flex h-full items-center gap-2">
      {!isRenaming ? (
        <Button type="button" variant="outline" size="icon" onClick={() => startRename(data)} aria-label="Rename">
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => toggleActive(data)}
        aria-label={data.active ? "Archive" : "Restore"}
      >
        {data.active ? <ArchiveIcon className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
      </Button>
      <Button type="button" variant="outline" size="icon" onClick={() => remove(data)} aria-label="Delete">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function PurityList() {
  const { data, isLoading, isError, error } = useMetalPurities({ includeInactive: true });
  const renamePurity = useRenamePurity();
  const setPurityActive = useSetPurityActive();
  const deletePurity = useDeletePurity();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MetalPurity | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MetalPurity | null>(null);

  const startRename = useCallback((purity: MetalPurity) => {
    setRenamingId(purity.id);
    setRenameValue(purity.purity);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue("");
  }, []);

  const saveRename = useCallback(
    (id: string) => {
      const purity = renameValue.trim();
      if (!purity) return;
      renamePurity.mutate(
        { id, purity },
        {
          onSuccess: () => {
            toast.success("Purity renamed");
            cancelRename();
          },
          onError: (err) => {
            // err.message is the generic "Validation failed" string for a
            // Zod rejection (e.g. the max-length check) - the actual reason
            // lives in err.fields.purity instead. Falls back to err.message
            // for every other error shape (e.g. PurityAlreadyExistsError's
            // 409, which has no .fields and already carries a specific
            // message there), same as AddPurityForm.tsx's own handling.
            toast.error(
              err instanceof ApiError ? (err.fields?.purity ?? err.message) : "Failed to rename purity",
            );
          },
        },
      );
    },
    [renameValue, renamePurity, cancelRename],
  );

  // Opens the confirm dialog rather than archiving/restoring immediately -
  // same pattern as remove/confirmDelete below. The actual mutation happens
  // in confirmToggleActive, triggered from the dialog's Archive/Restore
  // button.
  const toggleActive = useCallback((purity: MetalPurity) => {
    setArchiveTarget(purity);
  }, []);

  const confirmToggleActive = useCallback(() => {
    if (!archiveTarget) return;
    const purity = archiveTarget;
    setPurityActive.mutate(
      { id: purity.id, active: !purity.active },
      {
        onSuccess: () => {
          toast.success(purity.active ? "Purity archived" : "Purity restored");
          setArchiveTarget(null);
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Failed to update purity");
          setArchiveTarget(null);
        },
      },
    );
  }, [archiveTarget, setPurityActive]);

  // Opens the confirm dialog rather than deleting immediately - the actual
  // mutation happens in confirmDelete, triggered from the dialog's Delete
  // button.
  const remove = useCallback((purity: MetalPurity) => {
    setDeleteTarget(purity);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    const purity = deleteTarget;
    deletePurity.mutate(purity.id, {
      onSuccess: () => {
        toast.success("Purity deleted");
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Failed to delete purity");
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deletePurity]);

  // cellRendererParams carries the inline-rename state/handlers through to
  // the cell renderers. The handler functions below are plain declarations
  // (not useCallback), so this still regenerates every render in practice -
  // but it's wrapped in useMemo with an exhaustive dep list anyway, so
  // columnDefs' own dependency on this object stays honest rather than
  // suppressing the lint rule.
  const cellExtra = useMemo<PurityCellExtra>(
    () => ({
      renamingId,
      renameValue,
      setRenameValue,
      startRename,
      cancelRename,
      saveRename,
      toggleActive,
      remove,
    }),
    [renamingId, renameValue, startRename, cancelRename, saveRename, toggleActive, remove],
  );

  const columnDefs = useMemo<ColDef<MetalPurity>[]>(
    () => [
      { field: "metal", headerName: "Metal", width: 110, flex: 1, headerClass: AG_GRID_HEADER_CLASS },
      {
        headerName: "Purity",
        width: 150,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        cellRenderer: PurityCell,
        cellRendererParams: cellExtra,
      },
      {
        headerName: "Status",
        width: 120,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        cellRenderer: StatusCell,
        valueGetter: (p) => p.data?.active,
      },
      {
        headerName: "Actions",
        width: 170,
        flex: 1,
        headerClass: `${AG_GRID_HEADER_CLASS} text-right!`,
        cellRenderer: ActionsCell,
        cellRendererParams: cellExtra,
        sortable: false,
        filter: false,
      },
    ],
    [cellExtra],
  );

  const getRowClass = (params: RowClassParams<MetalPurity>) => (!params.data?.active ? "opacity-50" : undefined);

  return (
    <div className="panel mt-6 p-6">
      <h3 className="font-display text-xl text-foreground">All Purities</h3>

      <div className="mt-4">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Failed to load purities."}
          </p>
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No purities yet.</p>
        ) : (
          <AgGridReact<MetalPurity>
            theme={agGridTheme}
            defaultColDef={AG_GRID_DEFAULT_COL_DEF}
            rowData={data}
            columnDefs={columnDefs}
            getRowId={(p) => p.data.id}
            getRowClass={getRowClass}
            domLayout="autoHeight"
            suppressCellFocus
            animateRows={false}
          />
        )}
      </div>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete purity?">
        <p className="text-sm text-muted-foreground">
          Delete{" "}
          <span className="font-medium text-foreground">
            {deleteTarget?.metal} {deleteTarget?.purity}
          </span>
          ? This can&apos;t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteTarget(null)}
            disabled={deletePurity.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            disabled={deletePurity.isPending}
            onClick={confirmDelete}
          >
            {deletePurity.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        title={archiveTarget?.active ? "Archive purity?" : "Restore purity?"}
      >
        <p className="text-sm text-muted-foreground">
          {archiveTarget?.active ? (
            <>
              Archiving{" "}
              <span className="font-medium text-foreground">
                {archiveTarget?.metal} {archiveTarget?.purity}
              </span>{" "}
              hides it from the purity dropdowns used when creating new tags or setting rates. Tags and bills
              that already use it keep working as before - archiving doesn&apos;t delete anything or block
              billing.
            </>
          ) : (
            <>
              Restoring{" "}
              <span className="font-medium text-foreground">
                {archiveTarget?.metal} {archiveTarget?.purity}
              </span>{" "}
              makes it selectable again in the purity dropdowns for new tags and rates.
            </>
          )}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setArchiveTarget(null)}
            disabled={setPurityActive.isPending}
          >
            Cancel
          </Button>
          <Button type="button" disabled={setPurityActive.isPending} onClick={confirmToggleActive}>
            {setPurityActive.isPending
              ? archiveTarget?.active
                ? "Archiving…"
                : "Restoring…"
              : archiveTarget?.active
                ? "Archive"
                : "Restore"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
