"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  AddOldJewelleryItemDialog,
  type OldJewelleryItemFormValues,
} from "@/features/billing/components/AddOldJewelleryItemDialog";
import { useOldPurchaseStore, type OldJewelleryDraftItem } from "@/store/useOldPurchaseStore";

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

type DialogTarget = "add" | OldJewelleryDraftItem | null;

const HEADER_CLASS = "px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase";
const CELL_CLASS = "px-3 py-2.5 text-sm text-foreground";

function OldJewelleryItemRow({
  item,
  onEdit,
  onRemove,
}: {
  item: OldJewelleryDraftItem;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <tr className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={onEdit}>
      <td className={cn(CELL_CLASS, "font-medium")}>{item.description || "Untitled item"}</td>
      <td className={CELL_CLASS}>{item.metal}</td>
      <td className={CELL_CLASS}>{item.purity || "—"}</td>
      <td className={cn(CELL_CLASS, "text-right tabular-nums")}>{item.grossWtG.toFixed(3)}</td>
      <td className={cn(CELL_CLASS, "text-right tabular-nums")}>{item.stoneWtG.toFixed(3)}</td>
      <td className={cn(CELL_CLASS, "text-right tabular-nums")}>{item.dustWtG.toFixed(3)}</td>
      <td className={cn(CELL_CLASS, "text-right tabular-nums")}>{item.otherDeductionWtG.toFixed(3)}</td>
      <td className={cn(CELL_CLASS, "text-right tabular-nums font-medium")}>{item.netWtG.toFixed(3)}</td>
      <td className={cn(CELL_CLASS, "text-right tabular-nums")}>{item.appliedRatePerGram.toLocaleString("en-IN")}</td>
      <td className={cn(CELL_CLASS, "text-right font-semibold whitespace-nowrap")}>{formatInr(item.finalValue)}</td>
      <td className={cn(CELL_CLASS, "w-16 text-right")}>
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label="Edit old jewellery item"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remove old jewellery item"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Same list-with-modal UX as billing's OldJewelleryExchangeSection.tsx,
// reading/writing useOldPurchaseStore instead - reuses AddOldJewelleryItemDialog
// as-is (it's already store-agnostic: onSave/initialItem props, no store
// read inside it), so the billing flow's own section component stays
// untouched here too.
export function StandaloneItemsSection() {
  const items = useOldPurchaseStore((state) => state.items);
  const addItem = useOldPurchaseStore((state) => state.addItem);
  const updateItem = useOldPurchaseStore((state) => state.updateItem);
  const removeItem = useOldPurchaseStore((state) => state.removeItem);

  const [dialogTarget, setDialogTarget] = useState<DialogTarget>(null);

  const totalValue = items.reduce((sum, item) => sum + item.finalValue, 0);

  const handleSave = (values: OldJewelleryItemFormValues) => {
    if (dialogTarget === "add") {
      addItem(values);
    } else if (dialogTarget) {
      updateItem(dialogTarget.id, values);
    }
  };

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl text-foreground">Old Jewellery Items</h3>
        <Button type="button" variant="outline" size="md" onClick={() => setDialogTarget("add")}>
          <Plus className="h-4 w-4" /> Add item
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No items yet - add the old jewellery being purchased from the customer above.
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[920px] border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className={HEADER_CLASS}>Description *</th>
                  <th className={HEADER_CLASS}>Metal</th>
                  <th className={HEADER_CLASS}>Purity</th>
                  <th className={cn(HEADER_CLASS, "text-right")}>Gross Wt (g) *</th>
                  <th className={cn(HEADER_CLASS, "text-right")}>Stone Wt (g)</th>
                  <th className={cn(HEADER_CLASS, "text-right")}>Dust Wt (g)</th>
                  <th className={cn(HEADER_CLASS, "text-right")}>Other Ded. (g)</th>
                  <th className={cn(HEADER_CLASS, "text-right")}>Net Wt (g)</th>
                  <th className={cn(HEADER_CLASS, "text-right")}>Rate/g *</th>
                  <th className={cn(HEADER_CLASS, "text-right")}>Value</th>
                  <th className={HEADER_CLASS} />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <OldJewelleryItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => setDialogTarget(item)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-right text-sm font-medium text-foreground">
            Total: <span className="gold-text">{formatInr(totalValue)}</span>
          </p>
        </>
      )}

      {dialogTarget ? (
        <AddOldJewelleryItemDialog
          onClose={() => setDialogTarget(null)}
          initialItem={dialogTarget === "add" ? undefined : dialogTarget}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}
