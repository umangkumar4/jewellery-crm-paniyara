"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api-client";
import { CustomerFields } from "@/features/billing/components/CustomerFields";
import { TagBrowseDialog } from "@/features/billing/components/TagBrowseDialog";
import { ItemTable } from "@/features/billing/components/ItemTable";
import { TotalsPanel } from "@/features/billing/components/TotalsPanel";
import { PaymentPanel } from "@/features/billing/components/PaymentPanel";
import { calculateInvoiceTotals, calculateNewPending } from "@/features/billing/lib/calculations";
import { isItemValid } from "@/features/billing/lib/itemValidity";
import { useCreateInvoice } from "@/features/billing/hooks/useCreateInvoice";
import { useBillingStore, type BillingFieldErrors, type BillingItemErrors } from "@/store/useBillingStore";
import { createInvoiceSchema, type CreateInvoiceInput } from "@/schemas/invoice.schema";

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

  const customer = useBillingStore((state) => state.customer);
  const items = useBillingStore((state) => state.items);
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
  const { pendingAmount, paymentStatus } = calculateNewPending(totals.grandTotal, payment?.amount ?? 0);

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
        stone_charge: item.stoneCharge,
        tag_code: item.tagCode ?? undefined,
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
            <Button onClick={() => setConfirmation(null)}>New Sale</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
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

        <div className="panel p-5">
          <h3 className="font-display text-xl text-foreground">Totals &amp; Payment</h3>

          <div className="mt-4 flex flex-col gap-6 lg:flex-row">
            <div className="lg:flex-1">
              <TotalsPanel bare />
            </div>
            <div className="lg:flex-1">
              <PaymentPanel
                bare
                showHint
                payment={payment}
                onChange={setPayment}
                grandTotal={totals.grandTotal}
                error={fieldErrors["paid_amount"] ?? fieldErrors["payment.amount"] ?? fieldErrors["payment.mode"]}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
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
