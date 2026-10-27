"use client";

import { forwardRef } from "react";
import { NumberField, type NumberFieldProps } from "@/features/billing/components/NumberField";
import { isValidMoneyInput } from "@/features/billing/lib/numericInput";

// A rupee-and-paise money input (Discount, Stone Charge, Making Charge
// value) - identical to NumberField, except it caps entry at 2 decimal
// places, matching how rupees are actually denominated. Same wrap-not-
// reimplement pattern as WeightField.
export const MoneyField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ onValueChange, ...props }, ref) => {
    return (
      <NumberField
        ref={ref}
        {...props}
        onValueChange={(sanitized) => {
          if (!isValidMoneyInput(sanitized)) return;
          onValueChange(sanitized);
        }}
      />
    );
  },
);
MoneyField.displayName = "MoneyField";
