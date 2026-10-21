"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useInvoicePrintData } from "@/features/dashboard/hooks/useInvoiceDetail";
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
  const hasPrinted = useRef(false);

  useEffect(() => {
    if (invoice && !hasPrinted.current) {
      hasPrinted.current = true;
      window.print();
    }
  }, [invoice]);

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
  const pendingAtThatPoint = Math.max(0, invoice.grand_total - paidToDate);

  return (
    <div className="mx-auto max-w-md bg-background p-8 text-foreground">
      <div className="text-center">
        <h1 className="font-display text-2xl">{shopConfig.legalNameEn}</h1>
        <p className="text-sm text-muted-foreground">{shopConfig.legalNameHi}</p>
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
          <dt className="text-muted-foreground">Date</dt>
          <dd className="font-medium">{new Date(payment.paid_at).toLocaleString("en-IN")}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Mode</dt>
          <dd className="font-medium capitalize">{payment.mode.replace("_", " ")}</dd>
        </div>
      </dl>

      <div className="mt-5 rounded-lg bg-muted/40 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Received today</span>
          <span className="font-semibold text-gold">{formatInr(payment.amount)}</span>
        </div>
        <div className="gold-rule my-2" />
        <div className="flex justify-between text-base">
          <span className="text-muted-foreground">Invoice total</span>
          <span className="font-display text-lg font-semibold">{formatInr(invoice.grand_total)}</span>
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
