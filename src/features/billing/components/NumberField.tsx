"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Input } from "@/components/ui/Input";
import { sanitizeNumericInput, isValidNumericInput } from "@/features/billing/lib/numericInput";

export interface NumberFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
  // Already forwarded to Input via {...props} below - declared here too so
  // callers (e.g. MakingChargeDialog's ₹/% affixes) can pass them without a
  // type error.
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
}

// Composes the existing Input primitive rather than modifying it - Input.tsx
// itself is untouched, so Settings/Tagging/Auth forms (which drive their own
// number inputs through react-hook-form's different value-handling) carry
// zero risk from this change. See numericInput.ts for why type="number" was
// dropped in favor of this.
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ value, onValueChange, onBlur, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          if (!isValidNumericInput(raw)) return;
          onValueChange(sanitizeNumericInput(raw));
        }}
        onBlur={(e) => {
          if (value.trim() === "" || value === ".") {
            onValueChange("0");
          }
          onBlur?.(e);
        }}
        {...props}
      />
    );
  },
);
NumberField.displayName = "NumberField";
