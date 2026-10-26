"use client";

import { forwardRef } from "react";
import { NumberField, type NumberFieldProps } from "@/features/billing/components/NumberField";
import { isValidWeightInput } from "@/features/billing/lib/numericInput";

// A gram-weight input (gross/stone/net/dust/other-deduction) - identical to
// NumberField (same leading-zero fix, same text+inputMode="decimal"
// approach), except it caps entry at 3 decimal places, matching real
// jewellery scale precision (milligram resolution) and the 3dp rounding
// every net-weight calculation and printed bill already uses. Lives outside
// features/billing since Tagging uses it too, not just Billing.
export const WeightField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ onValueChange, ...props }, ref) => {
    return (
      <NumberField
        ref={ref}
        {...props}
        onValueChange={(sanitized) => {
          if (!isValidWeightInput(sanitized)) return;
          onValueChange(sanitized);
        }}
      />
    );
  },
);
WeightField.displayName = "WeightField";
