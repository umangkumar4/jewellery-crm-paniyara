"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SelectField } from "@/components/ui/SelectField";
import { toOptions } from "@/components/ui/react-select-styles";
import { METALS, type Metal } from "@/lib/metals";
import { useMetalPurities } from "@/features/settings/hooks/useMetalPurities";
import { NumberField } from "@/features/billing/components/NumberField";
import { calculateOldJewelleryItemValuation } from "@/features/billing/lib/calculations";
import { useBillingStore, type OldJewelleryDraftItem } from "@/store/useBillingStore";

const METAL_OPTIONS = toOptions(METALS);

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function OldJewelleryItemRow({ item }: { item: OldJewelleryDraftItem }) {
  const updateOldJewelleryItem = useBillingStore((s) => s.updateOldJewelleryItem);
  const removeOldJewelleryItem = useBillingStore((s) => s.removeOldJewelleryItem);

  // Active-only, same convention as the new-jewellery ManualAddForm's own
  // purity picker (not useAddTagItem's includeInactive=true - that's for
  // resolving an existing tag's already-assigned purity, not picking a
  // fresh one here).
  const { data: purities } = useMetalPurities({ metal: item.metal });
  const hasPurities = !!purities && purities.length > 0;
  const purityOptions = (purities ?? []).map((p) => ({ label: p.purity, value: p.purity }));

  // Recomputes netWtG/calculatedValue via the shared valuation engine, and -
  // since this is specifically a weight/rate change - also resets
  // finalValue to match the new calculatedValue. Same "auto-derive but
  // still directly editable, overwritten again on the next relevant
  // change" convention net weight itself already uses elsewhere in this
  // app (ItemTable.tsx's handleFieldChange does the identical thing for
  // making charge). A direct edit to finalValue itself goes through
  // updateOldJewelleryItem below instead, which never touches this path.
  const applyWeightOrRateChange = (patch: Partial<Omit<OldJewelleryDraftItem, "id">>) => {
    const next = { ...item, ...patch };
    const { calculatedValue } = calculateOldJewelleryItemValuation({
      grossWtG: next.grossWtG,
      stoneWtG: next.stoneWtG,
      dustWtG: next.dustWtG,
      otherDeductionWtG: next.otherDeductionWtG,
      ratePerGram: next.appliedRatePerGram,
    });
    updateOldJewelleryItem(item.id, { ...patch, finalValue: calculatedValue });
  };

  const isOverridden = item.finalValue !== item.calculatedValue;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-2">
            <Label htmlFor={`old-desc-${item.id}`}>Description *</Label>
            <Input
              id={`old-desc-${item.id}`}
              value={item.description}
              onChange={(e) => updateOldJewelleryItem(item.id, { description: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`old-metal-${item.id}`}>Metal</Label>
            <SelectField
              inputId={`old-metal-${item.id}`}
              options={METAL_OPTIONS}
              value={METAL_OPTIONS.find((o) => o.value === item.metal) ?? null}
              onChange={(option) => {
                const metal = (option?.value ?? METALS[0]) as Metal;
                // Switching metal invalidates whatever purity/rate was
                // picked for the old one - reset both rather than leave a
                // stale rate from a different metal silently in place,
                // same reasoning as the new-jewellery ManualAddForm.
                applyWeightOrRateChange({ metal, purity: "", defaultRatePerGram: null, appliedRatePerGram: 0 });
              }}
            />
          </div>
          <div>
            <Label htmlFor={`old-purity-${item.id}`}>Purity</Label>
            <SelectField
              inputId={`old-purity-${item.id}`}
              isDisabled={!hasPurities}
              isClearable={hasPurities}
              placeholder={hasPurities ? "Select purity" : "No purities yet"}
              options={purityOptions}
              value={hasPurities ? purityOptions.find((o) => o.value === item.purity) ?? null : null}
              onChange={(option) => {
                const purity = option?.value ?? "";
                const match = purities?.find((p) => p.purity === purity);
                const defaultRate = match?.purchase_rate_per_gram ?? null;
                applyWeightOrRateChange({
                  purity,
                  defaultRatePerGram: defaultRate,
                  appliedRatePerGram: defaultRate ?? 0,
                });
              }}
            />
          </div>

          <div>
            <Label htmlFor={`old-gross-${item.id}`}>Gross Wt (g) *</Label>
            <NumberField
              id={`old-gross-${item.id}`}
              value={String(item.grossWtG)}
              onValueChange={(v) => applyWeightOrRateChange({ grossWtG: Number(v) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor={`old-stone-${item.id}`}>Stone Wt (g)</Label>
            <NumberField
              id={`old-stone-${item.id}`}
              value={String(item.stoneWtG)}
              onValueChange={(v) => applyWeightOrRateChange({ stoneWtG: Number(v) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor={`old-dust-${item.id}`}>Dust Wt (g)</Label>
            <NumberField
              id={`old-dust-${item.id}`}
              value={String(item.dustWtG)}
              onValueChange={(v) => applyWeightOrRateChange({ dustWtG: Number(v) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor={`old-other-${item.id}`}>Other Deduction (g)</Label>
            <NumberField
              id={`old-other-${item.id}`}
              value={String(item.otherDeductionWtG)}
              onValueChange={(v) => applyWeightOrRateChange({ otherDeductionWtG: Number(v) || 0 })}
            />
          </div>

          <div>
            <Label>Net Wt (g)</Label>
            <p className="flex h-12 items-center px-1 text-sm text-muted-foreground">{item.netWtG.toFixed(3)} g</p>
          </div>
          <div>
            <Label htmlFor={`old-rate-${item.id}`}>Rate/g (₹) *</Label>
            <NumberField
              id={`old-rate-${item.id}`}
              value={String(item.appliedRatePerGram)}
              onValueChange={(v) => applyWeightOrRateChange({ appliedRatePerGram: Number(v) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor={`old-final-${item.id}`}>Final Value (₹)</Label>
            <NumberField
              id={`old-final-${item.id}`}
              value={String(item.finalValue)}
              onValueChange={(v) => updateOldJewelleryItem(item.id, { finalValue: Number(v) || 0 })}
            />
            {isOverridden ? (
              <p className="mt-1.5 text-xs text-muted-foreground">Calculated: {formatInr(item.calculatedValue)}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor={`old-reason-${item.id}`}>Override Reason</Label>
            <Input
              id={`old-reason-${item.id}`}
              value={item.overrideReason}
              onChange={(e) => updateOldJewelleryItem(item.id, { overrideReason: e.target.value })}
              placeholder={isOverridden ? "Why this value?" : "—"}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => removeOldJewelleryItem(item.id)}
          aria-label="Remove old jewellery item"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Simple repeated-row list, deliberately not ag-grid - a typical exchange
// is a handful of items (a ring, a chain, maybe a bangle set), not the
// dozens the main Items grid can hold, so the heavier grid component isn't
// worth it here. Settlement math (exchange-first application, excess/
// refund) is a later phase - this section only handles entering and
// valuing the old jewellery itself.
export function OldJewelleryExchangeSection() {
  const oldJewelleryItems = useBillingStore((state) => state.oldJewelleryItems);
  const addOldJewelleryItem = useBillingStore((state) => state.addOldJewelleryItem);

  const totalValue = oldJewelleryItems.reduce((sum, item) => sum + item.finalValue, 0);

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl text-foreground">Old Jewellery Exchange</h3>
        <Button type="button" variant="outline" size="md" onClick={addOldJewelleryItem}>
          <Plus className="h-4 w-4" /> Add old jewellery item
        </Button>
      </div>

      {oldJewelleryItems.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No old jewellery in this sale - add an item above if the customer is exchanging old jewellery.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {oldJewelleryItems.map((item) => (
              <OldJewelleryItemRow key={item.id} item={item} />
            ))}
          </div>
          <p className="mt-4 text-right text-sm font-medium text-foreground">
            Old jewellery total: <span className="gold-text">{formatInr(totalValue)}</span>
          </p>
        </>
      )}
    </div>
  );
}
