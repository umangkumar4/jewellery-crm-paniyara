"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ApiError } from "@/lib/api-client";
import { PaymentPanel } from "@/features/billing/components/PaymentPanel";
import { useAddPayment } from "@/features/billing/hooks/useAddPayment";
import { calculateNewPending } from "@/features/billing/lib/calculations";
import { useInvoiceDetail } from "@/features/dashboard/hooks/useInvoiceDetail";
import type { BillingPayment } from "@/store/useBillingStore";

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: invoice, isLoading, isError } = useInvoiceDetail(id);
  const [collectOpen, setCollectOpen] = useState(false);
  const [draftPayment, setDraftPayment] = useState<BillingPayment | null>(null);
  const addPayment = useAddPayment(id);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (isError || !invoice) {
    return <p className="text-sm text-destructive">Could not load this invoice.</p>;
  }

  const handleCollect = () => {
    if (!draftPayment || draftPayment.amount <= 0) return;
    const newPaid = invoice.paid_amount + draftPayment.amount;
    const { pendingAmount, paymentStatus } = calculateNewPending(invoice.grand_total, newPaid);

    addPayment.mutate(
      {
        amount: draftPayment.amount,
        mode: draftPayment.mode,
        paid_amount: newPaid,
        pending_amount: pendingAmount,
        payment_status: paymentStatus,
      },
      {
        onSuccess: () => {
          toast.success("Payment recorded");
          setCollectOpen(false);
          setDraftPayment(null);
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Could not record this payment.");
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-foreground">{invoice.invoice_no}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(invoice.created_at).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open(`/invoices/${id}/print`, "_blank")}>
            Print
          </Button>
          {invoice.payment_status !== "paid" ? (
            <Button onClick={() => setCollectOpen(true)}>Collect Payment</Button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="panel p-6 md:col-span-2">
          <h3 className="font-display text-lg text-foreground">Customer</h3>
          <p className="mt-2 text-sm text-foreground">{invoice.customer.name}</p>
          <p className="text-sm text-muted-foreground">{invoice.customer.phone}</p>
          {invoice.customer.email ? (
            <p className="text-sm text-muted-foreground">{invoice.customer.email}</p>
          ) : null}
          {invoice.customer.address ? (
            <p className="text-sm text-muted-foreground">{invoice.customer.address}</p>
          ) : null}

          <h3 className="mt-6 font-display text-lg text-foreground">Items</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium">Net Wt (g)</th>
                  <th className="py-2 pr-3 font-medium">Rate/g</th>
                  <th className="py-2 pr-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.sr_no} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-muted-foreground">{item.sr_no}</td>
                    <td className="py-2 pr-3 text-foreground">
                      {item.description}
                      {item.tag_code ? (
                        <span className="ml-2 text-xs text-muted-foreground">{item.tag_code}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{item.net_wt_g}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{formatInr(item.rate_per_gram)}</td>
                    <td className="py-2 pr-3 font-medium text-foreground">{formatInr(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 font-display text-lg text-foreground">Payments</h3>
          {invoice.payments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {invoice.payments.map((payment, index) => (
                <li key={index} className="flex items-center justify-between text-muted-foreground">
                  <span>
                    {payment.mode} · {new Date(payment.paid_at).toLocaleString("en-IN")}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-foreground">{formatInr(payment.amount)}</span>
                    <button
                      type="button"
                      onClick={() => window.open(`/invoices/${id}/payments/${index}/receipt`, "_blank")}
                      aria-label="Print receipt for this payment"
                      title="Print receipt for this payment"
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-6">
          <h3 className="font-display text-lg text-foreground">Totals</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-foreground">{formatInr(invoice.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="text-foreground">− {formatInr(invoice.discount_amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">GST ({invoice.gst_percent}%)</dt>
              <dd className="text-foreground">{formatInr(invoice.gst_amount)}</dd>
            </div>
            <div className="gold-rule my-2" />
            <div className="flex justify-between text-base font-semibold">
              <dt className="text-foreground">Grand Total</dt>
              <dd className="gold-text">{formatInr(invoice.grand_total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="text-foreground">{formatInr(invoice.paid_amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Pending</dt>
              <dd className="text-foreground">{formatInr(invoice.pending_amount)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <Dialog open={collectOpen} onClose={() => setCollectOpen(false)} title="Collect Payment">
        <PaymentPanel
          payment={draftPayment}
          onChange={setDraftPayment}
          grandTotal={invoice.pending_amount}
          bare
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCollectOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCollect}
            disabled={!draftPayment || draftPayment.amount <= 0 || addPayment.isPending}
          >
            {addPayment.isPending ? "Saving…" : "Save Payment"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
