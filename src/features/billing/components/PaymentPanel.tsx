"use client";

import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { NumberField } from "@/features/billing/components/NumberField";
import { useNumericStoreField } from "@/features/billing/lib/useNumericStoreField";
import type { BillingPayment, BillingPaymentMode } from "@/store/useBillingStore";

const PAYMENT_MODES: BillingPaymentMode[] = ["cash", "upi", "card", "bank_transfer"];

const MODE_LABELS: Record<BillingPaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank Transfer",
};

interface PaymentPanelProps {
  payment: BillingPayment | null;
  onChange: (payment: BillingPayment | null) => void;
  grandTotal: number;
  // false (default) for standalone placement on the billing page's own
  // grid; true when nested inside something already panel-styled (the
  // invoice detail page's "Collect Payment" Dialog, or the billing page's
  // combined Totals & Payment panel) to avoid a visible panel-inside-panel
  // border/shadow.
  bare?: boolean;
  // Caller-supplied, not read from any store - this component is reused on
  // the invoice detail page's "Collect Payment" dialog too, which has
  // nothing to do with the billing page's validation state.
  error?: string;
  // Independent of `bare` - `bare` only controls the outer panel/heading.
  // This controls the "Optional - leave the amount at 0..." hint
  // specifically, since that copy is billing-page-specific ("a fully
  // on-credit sale") and doesn't fit the invoice detail page's "collect a
  // payment against an existing invoice" dialog. Defaults to `!bare` so
  // both pre-existing call sites keep their exact current behavior.
  showHint?: boolean;
  // Label for the shortcut button that fills the amount field with
  // `grandTotal`. Defaults to "Pay full amount" (billing page: a new sale,
  // `grandTotal` is the full invoice total). The invoice detail page passes
  // "Pay remaining" instead, since there `grandTotal` is actually the
  // invoice's pending balance, not its total.
  payButtonLabel?: string;
}

// Reused as-is on the invoice detail page's "Collect Payment" dialog
// (Phase 10) - it only reports a {amount, mode} draft upward via onChange,
// so the POS creation flow and the later add-payment flow can each decide
// what to do with it without this component knowing which one it's in.
export function PaymentPanel({
  payment,
  onChange,
  grandTotal,
  bare = false,
  error,
  showHint,
  payButtonLabel = "Pay full amount",
}: PaymentPanelProps) {
  const effectiveShowHint = showHint ?? !bare;
  const amount = payment?.amount ?? 0;
  const mode = payment?.mode ?? "cash";

  // Same local-display-buffer pattern as TotalsPanel's discount/GST fields
  // (useNumericStoreField) - without it, typing "0" then "." would compute
  // Number("0.") === 0, which this logic treats as "no payment" and nulls
  // `payment` out, wiping the "." the user just typed before they could
  // type the next digit.
  const amountField = useNumericStoreField(amount, (value) => {
    if (value <= 0) {
      onChange(null);
    } else {
      onChange({ amount: value, mode });
    }
  });

  return (
    <div className={bare ? undefined : "panel p-6"}>
      {bare ? null : <h3 className="font-display text-xl text-foreground">Payment</h3>}
      {effectiveShowHint ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Optional - leave the amount at 0 for a fully on-credit sale.
        </p>
      ) : null}

      <div className={bare ? "grid grid-cols-2 gap-4" : "mt-4 grid grid-cols-2 gap-4"}>
        <div>
          <Label htmlFor="payment-amount">Amount Paid Now (₹)</Label>
          <NumberField
            id="payment-amount"
            value={amountField.value}
            onValueChange={amountField.onValueChange}
            className={error ? "border-destructive focus-visible:ring-destructive" : undefined}
          />
          {/* max isn't enforced by the input itself (NumberField is a plain
              text field, not type="number" - see numericInput.ts) - shown as
              a hint instead; the real enforcement is the backend schema plus
              the fieldErrors `error` message above, if it's ever exceeded.
              The button stays visible even with an error showing - it sets
              a known-valid amount (grandTotal), so it doubles as the fix
              for "you typed too much", not just a shortcut for the first try. */}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Up to ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
            <button
              type="button"
              // Goes through amountField.onValueChange, the same path
              // manual typing uses - keeps the display buffer, lastPushed,
              // and the store update all in sync via one code path instead
              // of a second one that could drift from it.
              onClick={() => amountField.onValueChange(String(grandTotal))}
              className="shrink-0 text-xs font-medium text-gold hover:underline"
            >
              {payButtonLabel}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="payment-mode">Mode</Label>
          <Select
            id="payment-mode"
            value={mode}
            disabled={amount <= 0}
            onChange={(e) => onChange({ amount, mode: e.target.value as BillingPaymentMode })}
          >
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
