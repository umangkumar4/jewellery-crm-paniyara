"use client";

import { forwardRef } from "react";
import { NumberField, type NumberFieldProps } from "@/features/billing/components/NumberField";
import { isValidWholeRupeeInput } from "@/features/billing/lib/numericInput";

// A whole-rupee-only money input (Payment Amount) - identical to
// NumberField, except it rejects a decimal point entirely. grandTotal and
// old-jewellery value are both whole rupees, so this guarantees the
// pending balance can never carry paise. Same wrap-not-reimplement
// pattern as WeightField/MoneyField.
export const WholeRupeeField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ onValueChange, ...props }, ref) => {
    return (
      <NumberField
        ref={ref}
        {...props}
        onValueChange={(sanitized) => {
          if (!isValidWholeRupeeInput(sanitized)) return;
          onValueChange(sanitized);
        }}
      />
    );
  },
);
WholeRupeeField.displayName = "WholeRupeeField";
