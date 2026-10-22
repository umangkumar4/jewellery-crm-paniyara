"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import { ApiError } from "@/lib/api-client";
import { PaymentPanel } from "@/features/billing/components/PaymentPanel";
import { useAddPayment } from "@/features/billing/hooks/useAddPayment";
import { calculateNewPending } from "@/features/billing/lib/calculations";
import { useInvoiceDetail } from "@/features/dashboard/hooks/useInvoiceDetail";
import type { InvoiceItemDetail } from "@/features/dashboard/hooks/useInvoiceDetail";
import type { BillingPayment } from "@/store/useBillingStore";

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DescriptionCell({ data }: ICellRendererParams<InvoiceItemDetail>) {
  if (!data) return null;
  return (
    <span>
      {data.description}
      {data.tag_code ? <span className="ml-2 text-xs text-muted-foreground">{data.tag_code}</span> : null}
    </span>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: invoice, isLoading, isError } = useInvoiceDetail(id);
  const [collectOpen, setCollectOpen] = useState(false);
  const [draftPayment, setDraftPayment] = useState<BillingPayment | null>(null);
  const addPayment = useAddPayment(id);

  const itemColumnDefs = useMemo<ColDef<InvoiceItemDetail>[]>(
    // Fixed widths, not flex - with 10 columns, flex forces every column to
    // shrink to fit the panel's width, truncating header text. Fixed
    // widths let every header stay fully readable; the grid scrolls
    // horizontally instead (same tradeoff as the original shadcn-table's
    // own `min-w-[820px]` + `overflow-x-auto`).
    () => [
      { field: "sr_no", headerName: "#", width: 60, headerClass: AG_GRID_HEADER_CLASS },
      { headerName: "Description", width: 220, headerClass: AG_GRID_HEADER_CLASS, cellRenderer: DescriptionCell },
      { field: "hsn_code", headerName: "HSN", width: 90, headerClass: AG_GRID_HEADER_CLASS },
      { field: "pieces", headerName: "Pcs", width: 70, headerClass: AG_GRID_HEADER_CLASS },
      { field: "gross_wt_g", headerName: "Gross Wt (g)", width: 130, headerClass: AG_GRID_HEADER_CLASS },
      { field: "stone_wt_g", headerName: "Stone Wt (g)", width: 130, headerClass: AG_GRID_HEADER_CLASS },
      { field: "net_wt_g", headerName: "Net Wt (g)", width: 120, headerClass: AG_GRID_HEADER_CLASS },
      {
        field: "rate_per_gram",
        headerName: "Rate/g",
        width: 120,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value != null ? formatInr(p.value) : ""),
      },
      {
        field: "making_charge",
        headerName: "Making",
        width: 120,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value != null ? formatInr(p.value) : ""),
      },
      {
        field: "total",
        headerName: "Total",
        width: 130,
        headerClass: AG_GRID_HEADER_CLASS,
        cellClass: "font-medium! text-foreground!",
        valueFormatter: (p) => (p.value != null ? formatInr(p.value) : ""),
      },
    ],
    [],
  );

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
          <div className="mt-3">
            <AgGridReact<InvoiceItemDetail>
              theme={agGridTheme}
              defaultColDef={AG_GRID_DEFAULT_COL_DEF}
              rowData={invoice.items}
              columnDefs={itemColumnDefs}
              getRowId={(p) => String(p.data.sr_no)}
              domLayout="autoHeight"
              suppressCellFocus
              animateRows={false}
            />
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
          payButtonLabel="Pay remaining"
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
