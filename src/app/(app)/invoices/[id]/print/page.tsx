"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useInvoicePrintData } from "@/features/dashboard/hooks/useInvoiceDetail";
import { shopConfig } from "@/lib/shop-config";

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// A Client Component, not the Server Component frontend_setup.md §6.2
// originally suggested - the session token lives only in sessionStorage
// (decision #8), so a server-rendered page has no way to attach it to the
// request. Every protected page in this app fetches client-side for the
// same reason; this one is no exception.
export default function InvoicePrintPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
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

  return (
    <div className="mx-auto max-w-2xl bg-background p-8 text-foreground">
      <div className="text-center">
        <h1 className="font-display text-2xl">{shopConfig.legalNameEn}</h1>
        <p className="text-sm text-muted-foreground">{shopConfig.legalNameHi}</p>
        <p className="mt-1 text-xs text-muted-foreground">GSTIN: {shopConfig.gstin}</p>
      </div>

      <div className="gold-rule my-4" />

      <div className="flex justify-between text-sm">
        <div>
          <p className="font-semibold">{invoice.customer.name}</p>
          <p className="text-muted-foreground">{invoice.customer.phone}</p>
          {invoice.customer.address ? (
            <p className="text-muted-foreground">{invoice.customer.address}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="font-semibold">{invoice.invoice_no}</p>
          <p className="text-muted-foreground">{new Date(invoice.created_at).toLocaleString("en-IN")}</p>
        </div>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-foreground/20">
            <th className="py-1.5 pr-2">#</th>
            <th className="py-1.5 pr-2">Description</th>
            <th className="py-1.5 pr-2">HSN</th>
            <th className="py-1.5 pr-2">Pcs</th>
            <th className="py-1.5 pr-2">Gross Wt (g)</th>
            <th className="py-1.5 pr-2">Stone Wt (g)</th>
            <th className="py-1.5 pr-2">Net Wt (g)</th>
            <th className="py-1.5 pr-2">Rate/g</th>
            <th className="py-1.5 pr-2">Making</th>
            <th className="py-1.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.sr_no} className="border-b border-foreground/10">
              <td className="py-1.5 pr-2">{item.sr_no}</td>
              <td className="py-1.5 pr-2">{item.description}</td>
              <td className="py-1.5 pr-2">{item.hsn_code}</td>
              <td className="py-1.5 pr-2">{item.pieces}</td>
              <td className="py-1.5 pr-2">{item.gross_wt_g}</td>
              <td className="py-1.5 pr-2">{item.stone_wt_g}</td>
              <td className="py-1.5 pr-2">{item.net_wt_g}</td>
              <td className="py-1.5 pr-2">{formatInr(item.rate_per_gram)}</td>
              <td className="py-1.5 pr-2">{formatInr(item.making_charge)}</td>
              <td className="py-1.5 text-right">{formatInr(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <dl className="w-56 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatInr(invoice.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Discount</dt>
            <dd>− {formatInr(invoice.discount_amount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>GST ({invoice.gst_percent}%)</dt>
            <dd>{formatInr(invoice.gst_amount)}</dd>
          </div>
          <div className="flex justify-between border-t border-foreground/20 pt-1.5 font-semibold">
            <dt>Grand Total</dt>
            <dd>{formatInr(invoice.grand_total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Paid</dt>
            <dd>{formatInr(invoice.paid_amount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Pending</dt>
            <dd>{formatInr(invoice.pending_amount)}</dd>
          </div>
        </dl>
      </div>

      {invoice.payments.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Payment mode: {invoice.payments.map((payment) => payment.mode).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
