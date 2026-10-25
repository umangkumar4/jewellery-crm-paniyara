"use client";

import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SelectField } from "@/components/ui/SelectField";
import type { SelectOption } from "@/components/ui/react-select-styles";
import { calculateExchangeApplied, calculateInvoiceTotals } from "@/features/billing/lib/calculations";
import { useBillingStore, type RefundMode } from "@/store/useBillingStore";

const REFUND_MODES: RefundMode[] = ["cash", "upi", "bank_transfer"];

const MODE_LABELS: Record<RefundMode, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
};

const REFUND_MODE_OPTIONS: SelectOption[] = REFUND_MODES.map((m) => ({ label: MODE_LABELS[m], value: m }));

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

export interface RefundSectionProps {
  // Same pattern as TotalsPanel/PaymentPanel's `bare` - false (default) for
  // standalone placement with its own panel card; true when nested inside
  // the billing page's Totals & Payment panel (right where "Amount to Pay"
  // is shown, so the whole settlement story - old jewellery total, amount
  // to pay, refund excess - reads as one block), to avoid a visible
  // panel-inside-panel double border/shadow.
  bare?: boolean;
}

// Renders only while the old jewellery exchange is worth more than the
// bill - refund-only (Customer Credit was built and then explicitly
// removed from this app's scope; see docs/old-jewellery-exchange-plan.md).
// Reads everything it needs directly from the store and recomputes via the
// same calculateExchangeApplied() TotalsPanel/billing/page.tsx already
// call, same "one shared source of truth" pattern used throughout this
// feature.
export function RefundSection({ bare = false }: RefundSectionProps = {}) {
  const items = useBillingStore((state) => state.items);
  const oldJewelleryItems = useBillingStore((state) => state.oldJewelleryItems);
  const discountAmount = useBillingStore((state) => state.discountAmount);
  const cgstPercent = useBillingStore((state) => state.cgstPercent);
  const sgstPercent = useBillingStore((state) => state.sgstPercent);
  const refund = useBillingStore((state) => state.refund);
  const updateRefund = useBillingStore((state) => state.updateRefund);

  const totals = calculateInvoiceTotals(items, discountAmount, cgstPercent, sgstPercent);
  const { excessAmount } = calculateExchangeApplied(oldJewelleryItems, totals.grandTotal);

  if (excessAmount <= 0) return null;

  const isComplete = refund.mode !== null && refund.confirmed;

  return (
    <div className={bare ? "mt-5 border-t border-border pt-4" : "panel p-5"}>
      <h3 className="font-display text-xl text-foreground">Refund Excess</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Old jewellery exceeds this bill by {formatInr(excessAmount)}. Pay the customer the excess outside the
        software, then record it here.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Refund Amount (₹)</Label>
          {/* Read-only, always exactly excessAmount - per the confirmed
              "exact match only" rule there's nothing for the admin to
              choose here, so there's no input to let it drift from the
              real excess. */}
          <p className="flex h-12 items-center rounded-lg border border-input bg-muted/30 px-4 text-sm font-medium text-foreground">
            {formatInr(excessAmount)}
          </p>
        </div>
        <div>
          <Label htmlFor="refund-mode">Mode *</Label>
          <SelectField
            inputId="refund-mode"
            options={REFUND_MODE_OPTIONS}
            placeholder="Select mode"
            value={REFUND_MODE_OPTIONS.find((o) => o.value === refund.mode) ?? null}
            onChange={(option) => updateRefund({ mode: (option?.value as RefundMode) ?? null })}
          />
        </div>
        <div>
          <Label htmlFor="refund-reference">Reference / UTR (optional)</Label>
          <Input
            id="refund-reference"
            value={refund.reference}
            onChange={(e) => updateRefund({ reference: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="refund-remarks">Remarks (optional)</Label>
          <Input
            id="refund-remarks"
            value={refund.remarks}
            onChange={(e) => updateRefund({ remarks: e.target.value })}
          />
        </div>
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={refund.confirmed}
          onChange={(e) => updateRefund({ confirmed: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-input"
        />
        I confirm this refund has been paid to the customer outside the software.
      </label>

      {!isComplete ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Mode and confirmation will be required before this sale can be finalized.
        </p>
      ) : null}
    </div>
  );
}
