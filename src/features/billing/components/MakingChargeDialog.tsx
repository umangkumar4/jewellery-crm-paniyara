"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { NumberField } from "@/features/billing/components/NumberField";
import { cn } from "@/lib/utils";
import { calculateMakingCharge, type MakingMethod } from "@/features/billing/lib/calculations";

const METHODS: { value: MakingMethod; label: string }[] = [
  { value: "fixed", label: "Fixed ₹" },
  { value: "per_gram", label: "₹/g" },
  { value: "percent_metal", label: "% metal" },
];

export interface MakingChargeDialogProps {
  onClose: () => void;
  initialMethod: MakingMethod;
  initialValue: number;
  // Needed to preview (and, on Apply, compute) the resulting ₹ figure for
  // the "per_gram"/"percent_metal" methods - this row's current net weight
  // and rate/g, exactly as calculateMakingCharge expects. Also shown in the
  // item-summary block below so the admin can see exactly which line this
  // dialog is about before applying a method to it.
  description: string;
  metal: string;
  purity: string;
  netWtG: number;
  ratePerGram: number;
  onApply: (result: { makingMethod: MakingMethod; makingValue: number; makingCharge: number }) => void;
}

// The one surface that ever sets making charge now - ItemTable's grid cell
// and ManualAddForm both mount this (conditionally, like ManualAddForm's
// own dialog) instead of taking a typed ₹ amount directly. There's no
// `open` prop by design: the caller only renders this component while a row
// is actively being edited, so useState's initializer runs fresh every time
// it's opened for a (possibly different) row, correctly pre-filling that
// row's real method/value instead of leftover state from a previous row.
export function MakingChargeDialog({
  onClose,
  initialMethod,
  initialValue,
  description,
  metal,
  purity,
  netWtG,
  ratePerGram,
  onApply,
}: MakingChargeDialogProps) {
  const [method, setMethod] = useState<MakingMethod>(initialMethod);
  const [value, setValue] = useState(String(initialValue));

  const preview = calculateMakingCharge({
    method,
    value: Number(value) || 0,
    netWtG,
    ratePerGram,
  });

  const handleMethodChange = (next: MakingMethod) => {
    if (next === method) return;
    setMethod(next);
    setValue("0");
  };

  const handleApply = () => {
    onApply({ makingMethod: method, makingValue: Number(value) || 0, makingCharge: preview });
    onClose();
  };

  const metalValue = Math.round(netWtG * ratePerGram);

  return (
    <Dialog open onClose={onClose} title="Making Charge" className="max-w-md" dimBackground={false}>
      {/* Which line this dialog is actually about - "per_gram"/"percent_metal"
          are formulas over this exact net weight and rate/g, so the admin
          should see both before typing a rate/percent against them. */}
      <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <p className="font-medium text-foreground">{description || "Untitled item"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {[metal, purity].filter(Boolean).join(" · ") || "—"} · Net Wt {netWtG.toLocaleString("en-IN")}g · Rate/g ₹
          {ratePerGram.toLocaleString("en-IN")}
          {metalValue > 0 ? ` · Metal Value ₹${metalValue.toLocaleString("en-IN")}` : ""}
        </p>
      </div>

      <Label>Making method</Label>
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => handleMethodChange(m.value)}
            className={cn(
              "h-11 rounded-lg border border-input text-sm font-semibold transition",
              method === m.value ? "bg-muted text-foreground" : "bg-card text-muted-foreground hover:bg-muted/50",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Label htmlFor="making-value">{method === "percent_metal" ? "Percent" : "Making"}</Label>
        <NumberField
          id="making-value"
          value={value}
          onValueChange={setValue}
          leadingIcon={method === "percent_metal" ? undefined : "₹"}
          trailingSlot={method === "percent_metal" ? "%" : undefined}
        />
        {method !== "fixed" ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            = ₹{preview.toLocaleString("en-IN")} on this line
          </p>
        ) : null}
      </div>

      <Button type="button" className="mt-4 w-full" onClick={handleApply}>
        Apply
      </Button>
    </Dialog>
  );
}
