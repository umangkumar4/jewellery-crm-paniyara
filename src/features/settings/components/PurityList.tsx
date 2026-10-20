"use client";

import { useState } from "react";
import { ArchiveRestore, Archive as ArchiveIcon, Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMetalPurities, type MetalPurity } from "@/features/settings/hooks/useMetalPurities";
import { useRenamePurity } from "@/features/settings/hooks/useRenamePurity";
import { useSetPurityActive } from "@/features/settings/hooks/useSetPurityActive";
import { useDeletePurity } from "@/features/settings/hooks/useDeletePurity";

export function PurityList() {
  const { data, isLoading, isError, error } = useMetalPurities({ includeInactive: true });
  const renamePurity = useRenamePurity();
  const setPurityActive = useSetPurityActive();
  const deletePurity = useDeletePurity();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function startRename(purity: MetalPurity) {
    setRenamingId(purity.id);
    setRenameValue(purity.purity);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  function saveRename(id: string) {
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
          toast.error(err instanceof ApiError ? err.message : "Failed to rename purity");
        },
      },
    );
  }

  function toggleActive(purity: MetalPurity) {
    setPurityActive.mutate(
      { id: purity.id, active: !purity.active },
      {
        onSuccess: () => {
          toast.success(purity.active ? "Purity archived" : "Purity restored");
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Failed to update purity");
        },
      },
    );
  }

  function remove(purity: MetalPurity) {
    deletePurity.mutate(purity.id, {
      onSuccess: () => {
        toast.success("Purity deleted");
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Failed to delete purity");
      },
    });
  }

  return (
    <div className="panel mt-6 p-6">
      <h3 className="font-display text-xl text-foreground">All Purities</h3>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-2 pr-3 font-medium">Metal</th>
              <th className="py-2 pr-3 font-medium">Purity</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-destructive">
                  {error instanceof ApiError ? error.message : "Failed to load purities."}
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">
                  No purities yet.
                </td>
              </tr>
            ) : (
              data.map((purity) => {
                const isRenaming = renamingId === purity.id;
                return (
                  <tr key={purity.id} className={cn("border-b border-border/60", !purity.active && "opacity-50")}>
                    <td className="py-3 pr-3 text-foreground">{purity.metal}</td>
                    <td className="py-3 pr-3 text-foreground">
                      {isRenaming ? (
                        <div className="flex items-center gap-2">
                          <Input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="h-9 w-28"
                          />
                          <button
                            type="button"
                            onClick={() => saveRename(purity.id)}
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
                      ) : (
                        purity.purity
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                          purity.active ? "bg-emerald-ink/10 text-emerald-ink" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {purity.active ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex justify-end gap-2">
                        {!isRenaming ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => startRename(purity)}
                            aria-label="Rename"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => toggleActive(purity)}
                          aria-label={purity.active ? "Archive" : "Restore"}
                        >
                          {purity.active ? (
                            <ArchiveIcon className="h-4 w-4" />
                          ) : (
                            <ArchiveRestore className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => remove(purity)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
