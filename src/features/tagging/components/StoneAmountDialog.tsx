"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { MoneyField } from "@/components/ui/MoneyField";
import { cn } from "@/lib/utils";
import { roundMoney } from "@/features/billing/lib/calculations";

// Only the two choosable methods - "not_set" (see tag.schema.ts) is a
// form-level state for "this dialog has never been applied", never a
// selectable option inside the dialog itself.
export type StoneAmountMethod = "fixed" | "per_gram";

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const METHODS: { value: StoneAmountMethod; label: string }[] = [
  { value: "fixed", label: "Fixed ₹" },
  { value: "per_gram", label: "₹/g" },
];

export interface StoneAmountDialogProps {
  onClose: () => void;
  initialMethod: StoneAmountMethod;
  initialValue: number;
  stoneWtG: number;
  onApply: (result: { stoneAmountMethod: StoneAmountMethod; totalStoneAmount: number; stoneAmount: number }) => void;
}

// Mirrors MakingChargeDialog.tsx's exact pattern - no `open` prop by
// design, the caller only mounts this while the dialog is actually shown,
// so useState's initializer runs fresh every time it's opened rather than
// carrying over a previous session's method/value.
export function StoneAmountDialog({ onClose, initialMethod, initialValue, stoneWtG, onApply }: StoneAmountDialogProps) {
  const [method, setMethod] = useState<StoneAmountMethod>(initialMethod);
  const [value, setValue] = useState(String(initialValue));

  const preview =
    method === "fixed" ? roundMoney(Number(value) || 0) : roundMoney((Number(value) || 0) * stoneWtG);

  const handleMethodChange = (next: StoneAmountMethod) => {
    if (next === method) return;
    setMethod(next);
    setValue("0");
  };

  const handleApply = () => {
    onApply({ stoneAmountMethod: method, totalStoneAmount: Number(value) || 0, stoneAmount: preview });
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title="Stone Amount" className="max-w-md">
      <Label>Stone amount method</Label>
      <div className="grid grid-cols-2 gap-2">
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
        <Label htmlFor="stone-amount-value">{method === "per_gram" ? "Rate per gram" : "Amount"}</Label>
        <MoneyField id="stone-amount-value" value={value} onValueChange={setValue} leadingIcon="₹" />
        {method === "per_gram" ? (
          <p className="mt-1.5 text-xs text-muted-foreground">= {formatInr(preview)} on this tag</p>
        ) : null}
      </div>

      <Button type="button" className="mt-4 w-full" onClick={handleApply}>
        Apply
      </Button>
    </Dialog>
  );
}
