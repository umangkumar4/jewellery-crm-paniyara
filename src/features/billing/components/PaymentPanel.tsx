"use client";

import { Label } from "@/components/ui/Label";
import { SelectField } from "@/components/ui/SelectField";
import type { SelectOption } from "@/components/ui/react-select-styles";
import { WholeRupeeField } from "@/components/ui/WholeRupeeField";
import { useNumericStoreField } from "@/features/billing/lib/useNumericStoreField";
import type { BillingPayment, BillingPaymentMode } from "@/store/useBillingStore";

const PAYMENT_MODES: BillingPaymentMode[] = ["cash", "upi", "card", "bank_transfer"];

const MODE_LABELS: Record<BillingPaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank Transfer",
};

const PAYMENT_MODE_OPTIONS: SelectOption[] = PAYMENT_MODES.map((m) => ({
  label: MODE_LABELS[m],
  value: m,
}));

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
  // Label for the shortcut button that fills the amount field with
  // `grandTotal`. Defaults to "Pay full amount" (billing page: a new sale,
  // `grandTotal` is the full invoice total). The invoice detail page passes
  // "Pay remaining" instead, since there `grandTotal` is actually the
  // invoice's pending balance, not its total.
  payButtonLabel?: string;
  // True when there's nothing left to collect (grandTotal, i.e. the cap
  // this panel was given, is already 0 - an old jewellery exchange fully
  // or more-than-fully covers the bill). Replaces the input entirely with
  // a plain statement instead of leaving an editable ₹0 field sitting
  // there - the caller is also responsible for clearing any stale payment
  // amount once this becomes true, so a value typed before enough old
  // jewellery was added can't silently ride along to Finalize.
  disabled?: boolean;
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
  payButtonLabel = "Pay full amount",
  disabled = false,
}: PaymentPanelProps) {
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

      {disabled ? (
        <p className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Fully settled by old jewellery exchange — no payment needed.
        </p>
      ) : (
        <div className={bare ? "grid grid-cols-2 gap-4" : "mt-4 grid grid-cols-2 gap-4"}>
          <div>
            <Label htmlFor="payment-amount">Amount Paid Now (₹)</Label>
            <WholeRupeeField
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
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <button
                type="button"
                // Goes through amountField.onValueChange, the same path
                // manual typing uses - keeps the display buffer, lastPushed,
                // and the store update all in sync via one code path instead
                // of a second one that could drift from it. Rounded here
                // (not just trusting grandTotal is already whole) because
                // this call bypasses WholeRupeeField's own validation gate
                // entirely - that gate only runs on typed input, not on a
                // direct onValueChange call like this one. grandTotal is
                // always whole for a new sale, but on the invoice detail
                // page's "Collect Payment" dialog this prop is actually the
                // pending balance, which could still be fractional for a
                // legacy invoice with pre-fix fractional payments recorded.
                onClick={() => amountField.onValueChange(String(Math.round(grandTotal)))}
                className="shrink-0 text-xs font-medium text-gold hover:underline"
              >
                {payButtonLabel}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="payment-mode">Mode</Label>
            <SelectField
              inputId="payment-mode"
              options={PAYMENT_MODE_OPTIONS}
              value={PAYMENT_MODE_OPTIONS.find((o) => o.value === mode) ?? null}
              isDisabled={amount <= 0}
              onChange={(option) =>
                onChange({ amount, mode: (option?.value ?? "cash") as BillingPaymentMode })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
