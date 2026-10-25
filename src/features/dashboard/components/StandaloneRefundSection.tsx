"use client";

import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SelectField } from "@/components/ui/SelectField";
import type { SelectOption } from "@/components/ui/react-select-styles";
import { useOldPurchaseStore, type RefundMode } from "@/store/useOldPurchaseStore";

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

// Always renders once at least one item has been added - there's no bill
// to offset against here, so every rupee of value is paid out as a refund
// (Customer Credit was built and then explicitly removed from this app's
// scope; see docs/old-jewellery-exchange-plan.md). Same "read-only amount,
// always re-derived live" rule as billing's RefundSection - there's no
// amount field to let drift from the real total.
export function StandaloneRefundSection() {
  const items = useOldPurchaseStore((state) => state.items);
  const refund = useOldPurchaseStore((state) => state.refund);
  const updateRefund = useOldPurchaseStore((state) => state.updateRefund);

  const totalValue = items.reduce((sum, item) => sum + item.finalValue, 0);

  if (items.length === 0) return null;

  const isComplete = refund.mode !== null && refund.confirmed;

  return (
    <div className="panel p-5">
      <h3 className="font-display text-xl text-foreground">Payout</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Pay the customer {formatInr(totalValue)} outside the software, then record it here.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Payout Amount (₹)</Label>
          <p className="flex h-12 items-center rounded-lg border border-input bg-muted/30 px-4 text-sm font-medium text-foreground">
            {formatInr(totalValue)}
          </p>
        </div>
        <div>
          <Label htmlFor="standalone-refund-mode">Mode *</Label>
          <SelectField
            inputId="standalone-refund-mode"
            options={REFUND_MODE_OPTIONS}
            placeholder="Select mode"
            value={REFUND_MODE_OPTIONS.find((o) => o.value === refund.mode) ?? null}
            onChange={(option) => updateRefund({ mode: (option?.value as RefundMode) ?? null })}
          />
        </div>
        <div>
          <Label htmlFor="standalone-refund-reference">Reference / UTR (optional)</Label>
          <Input
            id="standalone-refund-reference"
            value={refund.reference}
            onChange={(e) => updateRefund({ reference: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="standalone-refund-remarks">Remarks (optional)</Label>
          <Input
            id="standalone-refund-remarks"
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
        I confirm this payout has been paid to the customer outside the software.
      </label>

      {!isComplete ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Mode and confirmation are required before this purchase can be recorded.
        </p>
      ) : null}
    </div>
  );
}
