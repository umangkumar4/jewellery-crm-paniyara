"use client";

import { Label } from "@/components/ui/Label";
import { NumberField } from "@/features/billing/components/NumberField";
import { calculateInvoiceTotals } from "@/features/billing/lib/calculations";
import { useNumericStoreField } from "@/features/billing/lib/useNumericStoreField";
import { useBillingStore } from "@/store/useBillingStore";

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface TotalsPanelProps {
  // Same pattern as PaymentPanel's `bare` - false (default) for standalone
  // placement with its own panel card; true when nested inside something
  // already panel-styled (billing page's combined Totals & Payment panel)
  // to avoid a visible panel-inside-panel border/shadow.
  bare?: boolean;
}

export function TotalsPanel({ bare = false }: TotalsPanelProps) {
  const items = useBillingStore((state) => state.items);
  const discountAmount = useBillingStore((state) => state.discountAmount);
  const cgstPercent = useBillingStore((state) => state.cgstPercent);
  const sgstPercent = useBillingStore((state) => state.sgstPercent);
  const setDiscountAmount = useBillingStore((state) => state.setDiscountAmount);
  const setCgstPercent = useBillingStore((state) => state.setCgstPercent);
  const setSgstPercent = useBillingStore((state) => state.setSgstPercent);
  const fieldErrors = useBillingStore((state) => state.fieldErrors);

  // Live display and the numbers eventually sent in the POST body both come
  // from this same function - they can never disagree with each other.
  const totals = calculateInvoiceTotals(items, discountAmount, cgstPercent, sgstPercent);

  // calculateInvoiceTotals clamps discount to the subtotal (never a negative
  // taxable amount) - that clamped value is what the Discount row in the
  // summary below shows. Without this hint, typing a discount bigger than
  // the subtotal made the input and the summary visibly disagree with no
  // explanation why.
  const isDiscountClamped = discountAmount > totals.subtotal;

  const discountField = useNumericStoreField(discountAmount, setDiscountAmount);
  const cgstField = useNumericStoreField(cgstPercent, setCgstPercent);
  const sgstField = useNumericStoreField(sgstPercent, setSgstPercent);

  return (
    <div className={bare ? undefined : "panel p-5"}>
      {bare ? null : <h3 className="font-display text-xl text-foreground">Totals</h3>}

      <div className={bare ? "grid grid-cols-3 gap-4" : "mt-4 grid grid-cols-3 gap-4"}>
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
          ) : isDiscountClamped ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Capped at the subtotal, {formatInr(totals.subtotal)}.
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="cgst-percent">CGST %</Label>
          <NumberField
            id="cgst-percent"
            value={cgstField.value}
            onValueChange={cgstField.onValueChange}
            className={fieldErrors.cgst_percent ? "border-destructive focus-visible:ring-destructive" : undefined}
          />
          {fieldErrors.cgst_percent ? (
            <p className="mt-1.5 text-xs text-destructive">{fieldErrors.cgst_percent}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="sgst-percent">SGST %</Label>
          <NumberField
            id="sgst-percent"
            value={sgstField.value}
            onValueChange={sgstField.onValueChange}
            className={fieldErrors.sgst_percent ? "border-destructive focus-visible:ring-destructive" : undefined}
          />
          {fieldErrors.sgst_percent ? (
            <p className="mt-1.5 text-xs text-destructive">{fieldErrors.sgst_percent}</p>
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

      {bare ? (
        // Compact single-line summary for the combined Totals & Payment
        // panel - same figures as the stacked <dl> below, just laid out
        // horizontally to save vertical space.
        <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-foreground">{formatInr(totals.subtotal)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="text-foreground">− {formatInr(totals.discountAmount)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">CGST ({cgstPercent}%)</dt>
            <dd className="text-foreground">{formatInr(totals.cgstAmount)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">SGST ({sgstPercent}%)</dt>
            <dd className="text-foreground">{formatInr(totals.sgstAmount)}</dd>
          </div>
          <div className="flex items-center gap-1.5 text-base font-semibold">
            <dt className="text-foreground">Grand Total</dt>
            <dd className="gold-text">{formatInr(totals.grandTotal)}</dd>
          </div>
        </dl>
      ) : (
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
            <dt className="text-muted-foreground">CGST ({cgstPercent}%)</dt>
            <dd className="text-foreground">{formatInr(totals.cgstAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">SGST ({sgstPercent}%)</dt>
            <dd className="text-foreground">{formatInr(totals.sgstAmount)}</dd>
          </div>
          <div className="gold-rule my-2" />
          <div className="flex justify-between text-base font-semibold">
            <dt className="text-foreground">Grand Total</dt>
            <dd className="gold-text">{formatInr(totals.grandTotal)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
