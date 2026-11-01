"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/layout/BackButton";
import { useInvoicePrintData } from "@/features/dashboard/hooks/useInvoiceDetail";
import { calculateNewPending } from "@/features/billing/lib/calculations";
import { shopConfig } from "@/lib/shop-config";

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Client Component for the same reason as the main invoice print page - the
// session token lives only in sessionStorage, a server component has no
// way to attach it to the request.
//
// No dedicated backend endpoint - GET /api/invoices/:id/print already
// returns the full payments[] array, so this page just picks out one
// payment by its position in that array and derives this slip's numbers
// from it. Payments have no stable id of their own and are append-only (no
// edit/delete-payment feature exists), so the array index is a reasonably
// stable address for now.
export default function PaymentReceiptPage() {
  const params = useParams<{ id: string; index: string }>();
  const { id, index: indexParam } = params;
  const { data: invoice, isLoading, isError } = useInvoicePrintData(id);

  if (isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }
  if (isError || !invoice) {
    return <p className="p-8 text-sm text-destructive">Could not load this invoice.</p>;
  }

  const index = Number(indexParam);
  const payment =
    Number.isInteger(index) && index >= 0 && index < invoice.payments.length
      ? invoice.payments[index]
      : undefined;

  if (!payment) {
    return <p className="p-8 text-sm text-destructive">No payment found at this position.</p>;
  }

  // "Paid to date" is a snapshot as of THIS payment - the sum of every
  // payment up to and including it, in the order they were recorded - not
  // the invoice's current paid_amount. A receipt reprinted later should
  // keep showing what was true at the moment this payment was made, not
  // silently pick up payments collected afterward.
  const paidToDate = invoice.payments.slice(0, index + 1).reduce((sum, p) => sum + p.amount, 0);
  // Exchange is deducted before cash, exactly like calculateNewPending() does
  // everywhere else (addPayment() validation, the Totals panel, PaymentPanel) -
  // this receipt must not compute pending as if cash alone covers grand_total.
  const { pendingAmount: pendingAtThatPoint } = calculateNewPending(
    invoice.grand_total,
    invoice.exchange_applied,
    0, // creditUsed - always 0, same as every other caller (Credit phase is deferred)
    paidToDate,
  );

  return (
    <div className="mx-auto max-w-md bg-background p-8 text-foreground">
      {/* Controls - never printed, same pattern as PrintInvoice.tsx's own
          print:hidden Print button. Printing is click-only now, same as
          the main invoice print page - no auto window.print() on mount. */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <BackButton />
        <Button onClick={() => window.print()}>Print Receipt</Button>
      </div>

      <div className="text-center">
        <img src="/logo.png" alt="" className="mx-auto h-14 w-14 object-contain" />
        <p className="font-display mt-2 text-2xl">{shopConfig.heritageLineEn}</p>
        <h1 className="font-display text-2xl">{shopConfig.legalNameEn}</h1>
        <p className="mt-1 text-xs text-muted-foreground">GSTIN: {shopConfig.gstin}</p>
      </div>

      <div className="gold-rule my-4" />

      <p className="text-center text-xs font-semibold tracking-wide text-gold uppercase">
        Payment Receipt
      </p>

      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Invoice</dt>
          <dd className="font-medium">{invoice.invoice_no}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Customer</dt>
          <dd className="font-medium">{invoice.customer.name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Phone</dt>
          <dd className="font-medium">{invoice.customer.phone}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Date</dt>
          <dd className="font-medium">{new Date(payment.paid_at).toLocaleString("en-IN")}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Mode</dt>
          <dd className="font-medium capitalize">{payment.mode.replace("_", " ")}</dd>
        </div>
      </dl>

      <div className="mt-5 rounded-lg bg-muted/40">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Received today</span>
          <span className="font-semibold text-gold">{formatInr(payment.amount)}</span>
        </div>
        <div className="gold-rule my-2" />
        <div className="flex justify-between text-base">
          <span className="text-muted-foreground">Invoice total</span>
          <span className="font-semibold">{formatInr(invoice.grand_total)}</span>
        </div>
        {invoice.exchange_applied > 0 ? (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Old Jewellery Exchange Applied</span>
            <span className="font-medium">− {formatInr(invoice.exchange_applied)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Paid Till Now</span>
          <span className="font-semibold">− {formatInr(paidToDate)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Balance pending</span>
          <span className="font-semibold">{formatInr(pendingAtThatPoint)}</span>
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        For any follow-up, quote <span className="font-medium text-foreground">Invoice No. {invoice.invoice_no}</span>.
      </p>
    </div>
  );
}
