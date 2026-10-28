"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api-client";
import { CustomerFields } from "@/features/billing/components/CustomerFields";
import { TagBrowseDialog } from "@/features/billing/components/TagBrowseDialog";
import { ItemTable } from "@/features/billing/components/ItemTable";
import { OldJewelleryExchangeSection } from "@/features/billing/components/OldJewelleryExchangeSection";
import { RefundSection } from "@/features/billing/components/RefundSection";
import { TotalsPanel } from "@/features/billing/components/TotalsPanel";
import { PaymentPanel } from "@/features/billing/components/PaymentPanel";
import { calculateExchangeApplied, calculateInvoiceTotals, calculateNewPending } from "@/features/billing/lib/calculations";
import { isItemValid, isOldJewelleryItemValid } from "@/features/billing/lib/itemValidity";
import { useCreateInvoice } from "@/features/billing/hooks/useCreateInvoice";
import { useBillingStore, type BillingFieldErrors, type BillingItemErrors } from "@/store/useBillingStore";
import { createInvoiceSchema, type CreateInvoiceInput } from "@/schemas/invoice.schema";
import { BackButton } from "@/components/layout/BackButton";

// Same formatting as TotalsPanel's own formatInr - duplicated locally
// rather than extracted to a shared util for one extra call site.
function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Full-precision client-side validation, run right before submit with the
// exact schema the server uses. The server's 422 body only ever carries one
// flattened message per TOP-LEVEL field (so "customer" or "items" as a
// whole, never which sub-field or which row) - safeParse()'ing here first
// gives the real path for every issue (e.g. ["items", 2, "purity"]), so the
// UI can highlight the exact field on the exact row instead of a generic
// "Validation failed" toast with nothing turning red.
function collectValidationErrors(body: unknown): {
  fieldErrors: BillingFieldErrors;
  itemErrors: BillingItemErrors;
} {
  const result = createInvoiceSchema.safeParse(body);
  const fieldErrors: BillingFieldErrors = {};
  const itemErrors: BillingItemErrors = {};

  if (!result.success) {
    for (const issue of result.error.issues) {
      const [first, second, third] = issue.path;
      if (first === "items" && typeof second === "number") {
        const field = String(third ?? "_item");
        itemErrors[second] = { ...itemErrors[second], [field]: issue.message };
      } else {
        fieldErrors[issue.path.join(".")] = issue.message;
      }
    }
  }

  return { fieldErrors, itemErrors };
}

export default function BillingPage() {
  const [browseOpen, setBrowseOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<{ id: string; no: string } | null>(null);
  // Idempotency key for the exchange path (see docs/old-jewellery-exchange-plan.md's
  // Step 5 plan) - generated once per draft, lazily, and stays stable across
  // repeated Finalize clicks/retries on the SAME draft, so a double-click or
  // network retry is recognized server-side as the same operation rather
  // than creating a duplicate. Regenerated explicitly on "New Sale" below,
  // not on every render.
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());

  const customer = useBillingStore((state) => state.customer);
  const items = useBillingStore((state) => state.items);
  const oldJewelleryItems = useBillingStore((state) => state.oldJewelleryItems);
  const refund = useBillingStore((state) => state.refund);
  const discountAmount = useBillingStore((state) => state.discountAmount);
  const cgstPercent = useBillingStore((state) => state.cgstPercent);
  const sgstPercent = useBillingStore((state) => state.sgstPercent);
  const payment = useBillingStore((state) => state.payment);
  const setPayment = useBillingStore((state) => state.setPayment);
  const fieldErrors = useBillingStore((state) => state.fieldErrors);
  const setValidationErrors = useBillingStore((state) => state.setValidationErrors);
  const reset = useBillingStore((state) => state.reset);

  const createInvoice = useCreateInvoice();

  // Same calculations.ts the backend's loose sanity check expects to roughly
  // match - this is the live display AND the exact numbers submitted below.
  const totals = calculateInvoiceTotals(items, discountAmount, cgstPercent, sgstPercent);
  // Shared with TotalsPanel (which reads oldJewelleryItems from the store
  // itself and calls the identical function) - the number shown there and
  // the number used here for the payment cap can never drift apart.
  const exchangeSettlement = calculateExchangeApplied(oldJewelleryItems, totals.grandTotal);
  // creditUsed is always 0 - Customer Credit was built and then explicitly
  // removed from this app's scope, see docs/old-jewellery-exchange-plan.md.
  const { pendingAmount, paymentStatus, remainingBeforePayment } = calculateNewPending(
    totals.grandTotal,
    exchangeSettlement.exchangeApplied,
    0,
    payment?.amount ?? 0,
  );

  // Real, item-level validation for old jewellery - replaces the Step 3
  // placeholder gate that unconditionally blocked Finalize whenever any old
  // jewellery item existed (that gate existed only because the backend
  // couldn't persist exchange data yet - it now can, see
  // docs/old-jewellery-exchange-plan.md's Step 5 plan).
  const hasExcess = exchangeSettlement.excessAmount > 0;
  const isRefundComplete = refund.mode !== null && refund.confirmed;
  // Exchange covers the bill exactly, or more than covers it (the excess
  // case, settled separately via refund) - either way there's nothing left
  // to collect, so the Payment input gets replaced with a plain statement
  // instead of sitting there active with nothing valid to type into it.
  const isFullySettled = remainingBeforePayment <= 0;

  // Clears a payment amount that's now stale the moment old jewellery
  // exchange grows enough to cover the whole bill - an actual side effect
  // (a Zustand store write, not this component's own local state), so a
  // real useEffect is used rather than the "derive during render" pattern
  // this codebase uses elsewhere for local-state-only resets. Without this,
  // a value typed before enough old jewellery was added would stay in the
  // store (just hidden behind the now-disabled input) and could otherwise
  // still ride along to Finalize.
  useEffect(() => {
    if (isFullySettled && payment !== null) {
      setPayment(null);
    }
  }, [isFullySettled, payment, setPayment]);

  // Proactive, not just "fails on submit" - a row with rate_per_gram at 0
  // (or any other mandatory field unset) keeps the button disabled rather
  // than letting the cashier click Finalize Sale and only then discover
  // what's wrong. items.every() on an empty array is true, so the
  // items.length > 0 check still does its own separate job.
  const canFinalize =
    customer.name.trim().length > 0 &&
    customer.phone.trim().length > 0 &&
    items.length > 0 &&
    items.every(isItemValid) &&
    oldJewelleryItems.every(isOldJewelleryItemValid) &&
    (!hasExcess || isRefundComplete) &&
    !createInvoice.isPending;

  const handleFinalize = () => {
    const body: CreateInvoiceInput = {
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email?.trim() || undefined,
        address: customer.address?.trim() || undefined,
      },
      items: items.map((item) => ({
        description: item.description,
        hsn_code: item.hsnCode,
        metal: item.metal,
        purity: item.purity,
        pieces: item.pieces,
        gross_wt_g: item.grossWtG,
        stone_wt_g: item.stoneWtG,
        net_wt_g: item.netWtG,
        rate_per_gram: item.ratePerGram,
        making_charge: item.makingCharge,
        making_method: item.makingMethod,
        making_value: item.makingValue,
        stone_charge: item.stoneCharge,
        tag_code: item.tagCode ?? undefined,
        buyer_code: item.buyerCode?.trim() || undefined,
        total: item.total,
      })),
      discount_amount: totals.discountAmount,
      gst_percent: totals.gstPercent,
      gst_amount: totals.gstAmount,
      cgst_percent: cgstPercent,
      sgst_percent: sgstPercent,
      cgst_amount: totals.cgstAmount,
      sgst_amount: totals.sgstAmount,
      subtotal: totals.subtotal,
      grand_total: totals.grandTotal,
      payment: payment && payment.amount > 0 ? payment : undefined,
      paid_amount: payment?.amount ?? 0,
      pending_amount: pendingAmount,
      payment_status: paymentStatus,
      old_jewellery_items: oldJewelleryItems.map((item) => ({
        description: item.description,
        metal: item.metal,
        purity: item.purity,
        gross_wt_g: item.grossWtG,
        stone_wt_g: item.stoneWtG,
        dust_wt_g: item.dustWtG,
        other_deduction_wt_g: item.otherDeductionWtG,
        net_wt_g: item.netWtG,
        default_rate_per_gram: item.defaultRatePerGram,
        applied_rate_per_gram: item.appliedRatePerGram,
        calculated_value: item.calculatedValue,
        final_value: item.finalValue,
        override_reason: item.overrideReason || undefined,
      })),
      excess_settlement: hasExcess ? "refund" : null,
      refund:
        hasExcess && refund.mode
          ? {
              amount: exchangeSettlement.excessAmount,
              mode: refund.mode,
              reference: refund.reference || undefined,
              remarks: refund.remarks || undefined,
            }
          : undefined,
      operation_id: oldJewelleryItems.length > 0 ? operationId : undefined,
    };

    const { fieldErrors: nextFieldErrors, itemErrors: nextItemErrors } = collectValidationErrors(body);
    if (Object.keys(nextFieldErrors).length > 0 || Object.keys(nextItemErrors).length > 0) {
      setValidationErrors(nextFieldErrors, nextItemErrors);
      toast.error("Please fix the highlighted fields before finalizing the sale.");
      return;
    }

    createInvoice.mutate(body, {
      onSuccess: (result) => {
        setConfirmation({ id: result.invoice_id, no: result.invoice_no });
        reset();
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          // Tag-conflict errors (404/409) name the exact codes that failed -
          // surfacing them means the cashier can remove precisely those
          // lines and retry, instead of a generic "something went wrong"
          // that gives no clue which item to fix.
          if (error.codes?.length) {
            toast.error(`${error.message}: ${error.codes.join(", ")}`);
            return;
          }
          // Shouldn't normally happen - the client just validated with the
          // identical schema - but shown in full rather than the generic
          // "Validation failed" in case client/server schemas ever diverge.
          if (error.fields) {
            toast.error(Object.values(error.fields).join(" · "));
            return;
          }
          toast.error(error.message);
          return;
        }
        toast.error("Something went wrong. Please try again.");
      },
    });
  };

  // Explicit confirmation screen with Print/New Sale, no auto-redirect or
  // auto-print - see docs/billing-plan.md decision 12.
  if (confirmation) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="panel p-8">
          <h2 className="font-display text-2xl text-foreground">Sale Complete</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Invoice <span className="gold-text font-semibold">{confirmation.no}</span> created.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={() => window.open(`/invoices/${confirmation.id}/print`, "_blank")}
            >
              Print Receipt
            </Button>
            <Button
              onClick={() => {
                setConfirmation(null);
                // Fresh idempotency key for the next draft - reusing the
                // previous one would be harmless (it'd just never match an
                // existing invoice again), but a new draft is a genuinely
                // new operation, not a retry of the last one.
                setOperationId(crypto.randomUUID());
              }}
            >
              New Sale
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <BackButton />

      <h2 className="font-display text-2xl text-foreground">Billing</h2>
      <p className="mt-1 text-sm text-muted-foreground">Scan or add items, then finalize the sale.</p>

      {/* Single full-width column, not a sidebar split - each section lays
          its own fields out horizontally instead of stacking narrow
          columns, which is what was driving the excess scroll before. */}
      <div className="mt-6 space-y-4">
        <CustomerFields />

        {fieldErrors.items ? (
          <p className="text-sm text-destructive">{fieldErrors.items}</p>
        ) : null}
        <ItemTable onBrowseTags={() => setBrowseOpen(true)} />

        <OldJewelleryExchangeSection />

        <div className="panel p-5">
          <h3 className="font-display text-xl text-foreground">Totals &amp; Payment</h3>

          {/* A real 2-column grid with a visible divider, not two flex-1
              panes separated only by a gap - a labeled sub-heading on each
              side ("Charges"/"Payment") also means both columns now start
              with exactly one line above their input grid, so the rows
              underneath line up instead of drifting apart whenever one
              side's hint text wrapped differently than the other's. */}
          <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:divide-x lg:divide-border">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Charges</p>
              <div className="mt-3">
                <TotalsPanel bare />
              </div>
            </div>
            <div className="lg:pl-8">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Payment</p>
              <div className="mt-3">
                <PaymentPanel
                  bare
                  payment={payment}
                  onChange={setPayment}
                  // remainingBeforePayment, not the raw grand total - this
                  // prop is already semantically "the cap," not literally
                  // the invoice total (the invoice detail page's Collect
                  // Payment dialog already passes pending_amount here for
                  // the same reason), so an exchange reduces what "Pay full
                  // amount" fills in, same way a prior payment already would.
                  grandTotal={remainingBeforePayment}
                  payButtonLabel={exchangeSettlement.exchangeApplied > 0 ? "Pay remaining" : "Pay full amount"}
                  error={
                    fieldErrors["paid_amount"] ??
                    fieldErrors["payment.amount"] ??
                    fieldErrors["payment.mode"] ??
                    // Plain "payment" - the key this schema's own whole-
                    // rupee refine on the payment object actually produces
                    // (path: ["payment"], not ["payment", "amount"] - see
                    // invoice.schema.ts's comment on why).
                    fieldErrors["payment"]
                  }
                  disabled={isFullySettled}
                />
              </div>
            </div>
          </div>

          {/* Right after the Charges/Payment grid, not a separate panel
              above it - keeps the whole settlement story (old jewellery
              total → amount to pay → refund excess) reading as one block.
              bare drops its own panel card in favor of a plain top border,
              since it's now nested inside this panel instead of standing
              alone. */}
          <RefundSection bare />

          {oldJewelleryItems.length > 0 && !oldJewelleryItems.every(isOldJewelleryItemValid) ? (
            <p className="mt-4 text-sm text-destructive">
              Every old jewellery item needs a description, gross weight, and rate before this sale can be
              finalized.
            </p>
          ) : hasExcess && !isRefundComplete ? (
            <p className="mt-4 text-sm text-destructive">
              Choose a refund mode and confirm the payment above before this sale can be finalized.
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Paid {formatInr(payment?.amount ?? 0)} · Pending{" "}
              <span className="font-medium text-foreground">{formatInr(pendingAmount)}</span>
            </p>
            <Button className="w-full sm:w-auto" disabled={!canFinalize} onClick={handleFinalize}>
              {createInvoice.isPending ? "Finalizing…" : "Finalize Sale"}
            </Button>
          </div>
        </div>
      </div>

      <TagBrowseDialog open={browseOpen} onClose={() => setBrowseOpen(false)} />
    </div>
  );
}
