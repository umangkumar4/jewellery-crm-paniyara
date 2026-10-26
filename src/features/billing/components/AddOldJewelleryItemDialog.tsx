"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SelectField } from "@/components/ui/SelectField";
import { toOptions } from "@/components/ui/react-select-styles";
import { METALS, type Metal } from "@/lib/metals";
import { useMetalPurities } from "@/features/settings/hooks/useMetalPurities";
import { NumberField } from "@/features/billing/components/NumberField";
import { WeightField } from "@/components/ui/WeightField";
import { calculateOldJewelleryItemValuation } from "@/features/billing/lib/calculations";
import type { OldJewelleryDraftItem } from "@/store/useBillingStore";

const METAL_OPTIONS = toOptions(METALS);

export interface OldJewelleryItemFormValues {
  description: string;
  metal: string;
  purity: string;
  grossWtG: number;
  stoneWtG: number;
  dustWtG: number;
  otherDeductionWtG: number;
  defaultRatePerGram: number | null;
  appliedRatePerGram: number;
  finalValue: number;
  overrideReason: string;
}

export interface AddOldJewelleryItemDialogProps {
  onClose: () => void;
  // Present = editing that existing item, every field pre-filled from it.
  // Absent = adding a new one, blank defaults. Same "no `open` prop, caller
  // mounts this only while actively adding/editing one row" convention as
  // MakingChargeDialog - useState's initializer runs fresh every time this
  // is opened for a (possibly different) item.
  initialItem?: OldJewelleryDraftItem;
  onSave: (values: OldJewelleryItemFormValues) => void;
}

// Mirrors ItemTable.tsx's ManualAddForm - "Add Item" opens a modal with the
// full field set, filled values get appended to the list afterward, same
// convention the main Items grid already uses. Also doubles as the edit
// surface (via initialItem) for an already-added old jewellery item,
// instead of making every field directly editable in a compact list row.
export function AddOldJewelleryItemDialog({ onClose, initialItem, onSave }: AddOldJewelleryItemDialogProps) {
  const [description, setDescription] = useState(initialItem?.description ?? "");
  const [metal, setMetal] = useState<Metal>((initialItem?.metal as Metal) ?? METALS[0]);
  const [purity, setPurity] = useState(initialItem?.purity ?? "");
  const [grossWtG, setGrossWtG] = useState(String(initialItem?.grossWtG ?? 0));
  const [stoneWtG, setStoneWtG] = useState(String(initialItem?.stoneWtG ?? 0));
  const [dustWtG, setDustWtG] = useState(String(initialItem?.dustWtG ?? 0));
  const [otherDeductionWtG, setOtherDeductionWtG] = useState(String(initialItem?.otherDeductionWtG ?? 0));
  const [defaultRatePerGram, setDefaultRatePerGram] = useState<number | null>(
    initialItem?.defaultRatePerGram ?? null,
  );
  const [appliedRatePerGram, setAppliedRatePerGram] = useState(String(initialItem?.appliedRatePerGram ?? 0));
  const [finalValue, setFinalValue] = useState(String(initialItem?.finalValue ?? 0));
  const [overrideReason, setOverrideReason] = useState(initialItem?.overrideReason ?? "");

  // Active-only, same convention as the new-jewellery ManualAddForm's own
  // purity picker.
  const { data: purities } = useMetalPurities({ metal });
  const hasPurities = !!purities && purities.length > 0;
  const purityOptions = (purities ?? []).map((p) => ({ label: p.purity, value: p.purity }));

  // Recomputed fresh every render (cheap, pure) so the Net Wt / Calculated
  // labels are always accurate - separate from the finalValue auto-sync
  // side effect below, which only fires when a weight/rate input actually
  // changed since the last render (same "derive during render" pattern
  // ManualAddForm already uses for its own net-weight derivation).
  const { netWtG, calculatedValue } = calculateOldJewelleryItemValuation({
    grossWtG: Number(grossWtG) || 0,
    stoneWtG: Number(stoneWtG) || 0,
    dustWtG: Number(dustWtG) || 0,
    otherDeductionWtG: Number(otherDeductionWtG) || 0,
    ratePerGram: Number(appliedRatePerGram) || 0,
  });

  const [prevForValuation, setPrevForValuation] = useState({
    grossWtG,
    stoneWtG,
    dustWtG,
    otherDeductionWtG,
    appliedRatePerGram,
  });
  if (
    prevForValuation.grossWtG !== grossWtG ||
    prevForValuation.stoneWtG !== stoneWtG ||
    prevForValuation.dustWtG !== dustWtG ||
    prevForValuation.otherDeductionWtG !== otherDeductionWtG ||
    prevForValuation.appliedRatePerGram !== appliedRatePerGram
  ) {
    setPrevForValuation({ grossWtG, stoneWtG, dustWtG, otherDeductionWtG, appliedRatePerGram });
    setFinalValue(String(calculatedValue));
  }

  const isOverridden = (Number(finalValue) || 0) !== calculatedValue;

  const hasDescription = description.trim().length > 0;
  const hasGrossWt = Number(grossWtG) > 0;
  const hasRate = Number(appliedRatePerGram) > 0;
  const canSave = hasDescription && hasGrossWt && hasRate;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      description: description.trim(),
      metal,
      purity,
      grossWtG: Number(grossWtG) || 0,
      stoneWtG: Number(stoneWtG) || 0,
      dustWtG: Number(dustWtG) || 0,
      otherDeductionWtG: Number(otherDeductionWtG) || 0,
      defaultRatePerGram,
      appliedRatePerGram: Number(appliedRatePerGram) || 0,
      finalValue: Number(finalValue) || 0,
      overrideReason,
    });
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={initialItem ? "Edit Old Jewellery Item" : "Add Old Jewellery Item"}
      className="max-w-2xl"
      dimBackground={false}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-2">
          <Label htmlFor="old-item-description">Description *</Label>
          <Input id="old-item-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          {!hasDescription ? <p className="mt-1.5 text-xs text-destructive">Description is required</p> : null}
        </div>
        <div>
          <Label htmlFor="old-item-metal">Metal</Label>
          <SelectField
            inputId="old-item-metal"
            options={METAL_OPTIONS}
            value={METAL_OPTIONS.find((o) => o.value === metal) ?? null}
            onChange={(option) => {
              // Switching metal invalidates whatever purity/rate was
              // picked for the old one - same reset-both reasoning as the
              // new-jewellery ManualAddForm.
              setMetal((option?.value ?? METALS[0]) as Metal);
              setPurity("");
              setDefaultRatePerGram(null);
              setAppliedRatePerGram("0");
            }}
          />
        </div>
        <div>
          <Label htmlFor="old-item-purity">Purity</Label>
          <SelectField
            inputId="old-item-purity"
            isDisabled={!hasPurities}
            isClearable={hasPurities}
            placeholder={hasPurities ? "Select purity" : "No purities yet"}
            options={purityOptions}
            value={hasPurities ? purityOptions.find((o) => o.value === purity) ?? null : null}
            onChange={(option) => {
              const nextPurity = option?.value ?? "";
              const match = purities?.find((p) => p.purity === nextPurity);
              const defaultRate = match?.purchase_rate_per_gram ?? null;
              setPurity(nextPurity);
              setDefaultRatePerGram(defaultRate);
              setAppliedRatePerGram(String(defaultRate ?? 0));
            }}
          />
        </div>

        <div>
          <Label htmlFor="old-item-gross">Gross Wt (g) *</Label>
          <WeightField id="old-item-gross" value={grossWtG} onValueChange={setGrossWtG} />
          {!hasGrossWt ? <p className="mt-1.5 text-xs text-destructive">Gross weight is required</p> : null}
        </div>
        <div>
          <Label htmlFor="old-item-stone">Stone Wt (g)</Label>
          <WeightField id="old-item-stone" value={stoneWtG} onValueChange={setStoneWtG} />
        </div>
        <div>
          <Label htmlFor="old-item-dust">Dust Wt (g)</Label>
          <WeightField id="old-item-dust" value={dustWtG} onValueChange={setDustWtG} />
        </div>
        <div>
          <Label htmlFor="old-item-other">Other Deduction (g)</Label>
          <WeightField id="old-item-other" value={otherDeductionWtG} onValueChange={setOtherDeductionWtG} />
        </div>

        <div>
          <Label>Net Wt (g)</Label>
          <p className="flex h-12 items-center px-1 text-sm text-muted-foreground">{netWtG.toFixed(3)} g</p>
        </div>
        <div>
          <Label htmlFor="old-item-rate">Rate/g (₹) *</Label>
          <NumberField id="old-item-rate" value={appliedRatePerGram} onValueChange={setAppliedRatePerGram} />
          {!hasRate ? <p className="mt-1.5 text-xs text-destructive">Rate is required</p> : null}
        </div>
        <div>
          <Label htmlFor="old-item-final">Final Value (₹)</Label>
          <NumberField id="old-item-final" value={finalValue} onValueChange={setFinalValue} />
          {isOverridden ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Calculated: ₹{calculatedValue.toLocaleString("en-IN")}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="old-item-reason">Override Reason</Label>
          <Input
            id="old-item-reason"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder={isOverridden ? "Why this value?" : "—"}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={!canSave}>
          {initialItem ? "Save Changes" : "Add Item"}
        </Button>
      </div>
    </Dialog>
  );
}
