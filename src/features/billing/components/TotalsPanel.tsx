"use client";

import { Label } from "@/components/ui/Label";
import { NumberField } from "@/features/billing/components/NumberField";
import { calculateInvoiceTotals } from "@/features/billing/lib/calculations";
import { useNumericStoreField } from "@/features/billing/lib/useNumericStoreField";
import { useBillingStore } from "@/store/useBillingStore";

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TotalsPanel() {
  const items = useBillingStore((state) => state.items);
  const discountAmount = useBillingStore((state) => state.discountAmount);
  const gstPercent = useBillingStore((state) => state.gstPercent);
  const setDiscountAmount = useBillingStore((state) => state.setDiscountAmount);
  const setGstPercent = useBillingStore((state) => state.setGstPercent);
  const fieldErrors = useBillingStore((state) => state.fieldErrors);

  // Live display and the numbers eventually sent in the POST body both come
  // from this same function - they can never disagree with each other.
  const totals = calculateInvoiceTotals(items, discountAmount, gstPercent);

  const discountField = useNumericStoreField(discountAmount, setDiscountAmount);
  const gstField = useNumericStoreField(gstPercent, setGstPercent);

  return (
    <div className="panel p-6">
      <h3 className="font-display text-xl text-foreground">Totals</h3>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="discount-amount">Discount (₹)</Label>
          <NumberField
            id="discount-amount"
            value={discountField.value}
            onValueChange={discountField.onValueChange}
            className={fieldErrors.discount_amount ? "border-destructive focus-visible:ring-destructive" : undefined}
          />
          {fieldErrors.discount_amount ? (
            <p className="mt-1.5 text-xs text-destructive">{fieldErrors.discount_amount}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="gst-percent">GST %</Label>
          <NumberField
            id="gst-percent"
            value={gstField.value}
            onValueChange={gstField.onValueChange}
            className={fieldErrors.gst_percent ? "border-destructive focus-visible:ring-destructive" : undefined}
          />
          {fieldErrors.gst_percent ? (
            <p className="mt-1.5 text-xs text-destructive">{fieldErrors.gst_percent}</p>
          ) : null}
        </div>
      </div>

      {/* subtotal/gst_amount/grand_total are all derived consistently from
          calculations.ts, so these should never actually fire in normal
          use - shown anyway rather than silently swallowed, in case a
          future change to either side ever makes them disagree. */}
      {fieldErrors.grand_total || fieldErrors.gst_amount || fieldErrors.subtotal ? (
        <p className="mt-2 text-xs text-destructive">
          {fieldErrors.grand_total ?? fieldErrors.gst_amount ?? fieldErrors.subtotal}
        </p>
      ) : null}

      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-foreground">{formatInr(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Discount</dt>
          <dd className="text-foreground">− {formatInr(totals.discountAmount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">GST ({gstPercent}%)</dt>
          <dd className="text-foreground">{formatInr(totals.gstAmount)}</dd>
        </div>
        <div className="gold-rule my-2" />
        <div className="flex justify-between text-base font-semibold">
          <dt className="text-foreground">Grand Total</dt>
          <dd className="gold-text">{formatInr(totals.grandTotal)}</dd>
        </div>
      </dl>
    </div>
  );
}
