"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import { ApiError } from "@/lib/api-client";
import { PaymentPanel } from "@/features/billing/components/PaymentPanel";
import { useAddPayment } from "@/features/billing/hooks/useAddPayment";
import { useDeleteInvoice } from "@/features/dashboard/hooks/useDeleteInvoice";
import { calculateNewPending, isValueOverridden } from "@/features/billing/lib/calculations";
import { useInvoiceDetail } from "@/features/dashboard/hooks/useInvoiceDetail";
import type { InvoiceDetail, InvoiceItemDetail, ExchangeSettlementType } from "@/features/dashboard/hooks/useInvoiceDetail";
import type { OldPurchaseItemDetail } from "@/features/dashboard/hooks/useOldPurchaseDetail";
import type { BillingPayment } from "@/store/useBillingStore";
import { BackButton } from "@/components/layout/BackButton";

// Same per-component local-color-map convention InvoiceGrid.tsx and
// PrintInvoice.tsx already each use for their own STATUS_BADGE, rather than
// a shared constant.
const PAYMENT_STATUS_BADGE: Record<InvoiceDetail["payment_status"], string> = {
  unpaid: "bg-destructive/10 text-destructive",
  partial: "bg-gold/20 text-gold-foreground",
  paid: "bg-emerald-ink/10 text-emerald-ink",
};

// "none" deliberately has no entry - the badge is never rendered for an
// ordinary invoice, so there's nothing to look up.
const EXCHANGE_BADGE: Record<Exclude<ExchangeSettlementType, "none">, string> = {
  partial: "bg-gold/20 text-gold-foreground",
  exact: "bg-emerald-ink/10 text-emerald-ink",
  // Informational, not a problem state - reuses the same "notable" tone as
  // partial, deliberately not the destructive/red used for unpaid.
  excess: "bg-gold/20 text-gold-foreground",
};
const EXCHANGE_LABEL: Record<Exclude<ExchangeSettlementType, "none">, string> = {
  partial: "Partial Exchange",
  exact: "Exact Exchange",
  excess: "Excess / Refund",
};

// cgst_amount/sgst_amount are optional at the schema level (see
// Invoice.model.ts) - nullish here means a document written outside the
// normal createInvoice() flow, not a real "₹0" amount, so it renders as
// "—" rather than crashing on undefined.toLocaleString().
function formatInr(value: number | null | undefined): string {
  if (value == null) return "—";
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
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: invoice, isLoading, isError } = useInvoiceDetail(id);
  const [collectOpen, setCollectOpen] = useState(false);
  const [draftPayment, setDraftPayment] = useState<BillingPayment | null>(null);
  const addPayment = useAddPayment(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const deleteInvoice = useDeleteInvoice(id);

  const itemColumnDefs = useMemo<ColDef<InvoiceItemDetail>[]>(
    // Fixed widths, not flex - with 10 columns, flex forces every column to
    // shrink to fit the panel's width, truncating header text. Fixed
    // widths let every header stay fully readable; the grid scrolls
    // horizontally instead (same tradeoff as the original shadcn-table's
    // own `min-w-[820px]` + `overflow-x-auto`).
    () => [
      { field: "sr_no", headerName: "#", width: 60, headerClass: AG_GRID_HEADER_CLASS },
      { headerName: "Description", width: 220, headerClass: AG_GRID_HEADER_CLASS, cellRenderer: DescriptionCell },
      {
        field: "buyer_code",
        headerName: "Buyer Code",
        width: 130,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value ? p.value : "—"),
      },
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

  // Same ag-grid convention as the main items table above (this page's own
  // established pattern) rather than copying PrintInvoice.tsx's bordered-
  // HTML-table style - each page stays internally consistent with itself.
  // No HSN/Pcs/Making/Stone Charge - don't apply to a buy-back, see
  // docs/old-jewellery-exchange-plan.md.
  const oldItemColumnDefs = useMemo<ColDef<OldPurchaseItemDetail>[]>(
    () => [
      { field: "sr_no", headerName: "#", width: 60, headerClass: AG_GRID_HEADER_CLASS },
      { field: "description", headerName: "Description", width: 200, headerClass: AG_GRID_HEADER_CLASS },
      { field: "metal", headerName: "Metal", width: 90, headerClass: AG_GRID_HEADER_CLASS },
      { field: "purity", headerName: "Purity", width: 90, headerClass: AG_GRID_HEADER_CLASS },
      { field: "gross_wt_g", headerName: "Gross Wt (g)", width: 120, headerClass: AG_GRID_HEADER_CLASS },
      { field: "stone_wt_g", headerName: "Stone Wt (g)", width: 120, headerClass: AG_GRID_HEADER_CLASS },
      { field: "dust_wt_g", headerName: "Dust Wt (g)", width: 110, headerClass: AG_GRID_HEADER_CLASS },
      {
        field: "other_deduction_wt_g",
        headerName: "Other Deduction (g)",
        width: 150,
        headerClass: AG_GRID_HEADER_CLASS,
      },
      { field: "net_wt_g", headerName: "Net Wt (g)", width: 110, headerClass: AG_GRID_HEADER_CLASS },
      {
        field: "applied_rate_per_gram",
        headerName: "Rate/g",
        width: 120,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value != null ? formatInr(p.value) : ""),
      },
      {
        field: "final_value",
        headerName: "Value",
        width: 130,
        headerClass: AG_GRID_HEADER_CLASS,
        cellClass: "font-medium! text-foreground!",
        valueFormatter: (p) => (p.value != null ? formatInr(p.value) : ""),
      },
      {
        headerName: "Override Reason",
        width: 200,
        headerClass: AG_GRID_HEADER_CLASS,
        // Plain field, not a stacked cell under Value - ag-grid cells don't
        // support multi-line content the way a plain HTML <td> does (what
        // OldJewelleryExchangeSection.tsx/StandaloneItemsSection.tsx use),
        // so a dedicated single-line column is the reliable way to show
        // this here instead of fighting row-height/overflow on the cell.
        valueGetter: (p) =>
          p.data && isValueOverridden(p.data.final_value, p.data.calculated_value) ? p.data.override_reason : "—",
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

  // old_jewellery_items is embedded directly on the invoice response now
  // (invoicesService.ts's findOldJewelleryExchangeItems()) - no second
  // fetch to GET /api/old-purchases/:id needed just to render this page.
  const hasExchange = invoice.exchange_applied > 0 && invoice.old_jewellery_items.length > 0;
  // Same floor as PrintInvoice.tsx - exchange_applied is already correctly
  // capped at grand_total server-side, so this shouldn't go negative, but
  // the floor costs nothing and matches the same defensive convention.
  const amountToPay = Math.max(0, invoice.grand_total - invoice.exchange_applied);
  // The real, uncapped total - exchange_applied alone under-reports it
  // whenever old jewellery is worth more than the bill (the excess/refund
  // case), same fix as PrintInvoice.tsx's oldValueTotal.
  const oldJewelleryTotal = invoice.old_jewellery_items.reduce((sum, item) => sum + item.final_value, 0);

  const handleCollect = () => {
    if (!draftPayment || draftPayment.amount <= 0) return;
    const newPaid = invoice.paid_amount + draftPayment.amount;
    // invoice.exchange_applied, not a placeholder 0 - wired up in Step 5
    // (docs/old-jewellery-exchange-plan.md). creditUsed stays 0, reserved
    // for the deferred Credit phase. 0 for every ordinary invoice, so this
    // is unchanged for the common case.
    const { pendingAmount, paymentStatus } = calculateNewPending(
      invoice.grand_total,
      invoice.exchange_applied,
      0,
      newPaid,
    );

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

  const handleDelete = () => {
    const reason = deleteReason.trim();
    if (!reason) return;
    deleteInvoice.mutate(reason, {
      onSuccess: () => {
        toast.success("Invoice deleted");
        // Redirect, not just close the dialog - this page would otherwise
        // 404 on its own next refetch (findInvoiceById now excludes a
        // deleted invoice), so staying here would be a dead end.
        router.push("/invoices");
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : "Could not delete this invoice.");
      },
    });
  };

  return (
    <div className="mx-2 max-w-full">
      <BackButton />

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
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
          >
            Delete Invoice
          </Button>
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

          {hasExchange ? (
            <>
              <h3 className="mt-6 font-display text-lg text-foreground">Old Jewellery Exchange</h3>
              <div className="mt-3">
                <AgGridReact<OldPurchaseItemDetail>
                  theme={agGridTheme}
                  defaultColDef={AG_GRID_DEFAULT_COL_DEF}
                  rowData={invoice.old_jewellery_items}
                  columnDefs={oldItemColumnDefs}
                  getRowId={(p) => String(p.data.sr_no)}
                  domLayout="autoHeight"
                  suppressCellFocus
                  animateRows={false}
                />
              </div>
            </>
          ) : null}

          <h3 className="mt-6 font-display text-lg text-foreground">Payments</h3>
          {invoice.payments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {invoice.payments.map((payment, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-2.5"
                >
                  <div className="text-sm">
                    <span className="font-medium capitalize text-foreground">{payment.mode}</span>
                    <span className="mx-1.5 text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {new Date(payment.paid_at).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{formatInr(payment.amount)}</span>
                    <button
                      type="button"
                      onClick={() => window.open(`/invoices/${id}/payments/${index}/receipt`, "_blank")}
                      aria-label="Print receipt for this payment"
                      title="Print receipt for this payment"
                      className="rounded-full p-1.5 text-muted-foreground transition hover:bg-background hover:text-foreground"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-foreground">Totals</h3>
            {/* Only when there's actually an exchange to flag - an
                ordinary invoice (the overwhelming majority) shows no
                badge at all, same as today. */}
            {invoice.exchange_settlement_type !== "none" ? (
              <Badge
                variant="outline"
                className={`border-transparent font-medium ${EXCHANGE_BADGE[invoice.exchange_settlement_type]}`}
              >
                {EXCHANGE_LABEL[invoice.exchange_settlement_type]}
              </Badge>
            ) : null}
          </div>
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
              <dt className="text-muted-foreground">CGST ({invoice.cgst_percent ?? "—"}%)</dt>
              <dd className="text-foreground">{formatInr(invoice.cgst_amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">SGST ({invoice.sgst_percent ?? "—"}%)</dt>
              <dd className="text-foreground">{formatInr(invoice.sgst_amount)}</dd>
            </div>
            <div className="gold-rule my-2" />
            <div className="flex justify-between text-base font-semibold">
              <dt className="text-foreground">Grand Total</dt>
              <dd className="gold-text">{formatInr(invoice.grand_total)}</dd>
            </div>
            {/* Settlement line, not a repricing - the grand total above
                never changes because of an exchange. Gated on > 0 so every
                ordinary invoice (the overwhelming majority) renders
                exactly as it did before this existed. Paid/Pending nest
                under Amount to Pay here (indented, with a connecting
                marker) so they read as its breakdown instead of two
                disconnected rows the reader has to reconcile by hand -
                only done in the exchange case, since without an exchange
                Paid/Pending already unambiguously relate to Grand Total. */}
            {invoice.exchange_applied > 0 ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Old Jewellery Total</dt>
                  <dd className="text-foreground">{formatInr(oldJewelleryTotal)}</dd>
                </div>
                <div className="flex justify-between font-medium">
                  <dt className="text-foreground">Amount to Pay</dt>
                  <dd className="text-foreground">{formatInr(amountToPay)}</dd>
                </div>
                <div className="flex justify-between pl-4 text-xs">
                  <dt className="text-muted-foreground">↳ Paid</dt>
                  <dd className="text-muted-foreground">{formatInr(invoice.paid_amount)}</dd>
                </div>
                <div className="flex items-center justify-between pl-4 text-xs">
                  <dt className="text-muted-foreground">↳ Pending</dt>
                  <dd className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{formatInr(invoice.pending_amount)}</span>
                    <Badge
                      variant="outline"
                      className={`border-transparent font-medium capitalize ${PAYMENT_STATUS_BADGE[invoice.payment_status]}`}
                    >
                      {invoice.payment_status}
                    </Badge>
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd className="text-foreground">{formatInr(invoice.paid_amount)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Pending</dt>
                  <dd className="flex items-center gap-1.5">
                    <span className="text-foreground">{formatInr(invoice.pending_amount)}</span>
                    <Badge
                      variant="outline"
                      className={`border-transparent font-medium capitalize ${PAYMENT_STATUS_BADGE[invoice.payment_status]}`}
                    >
                      {invoice.payment_status}
                    </Badge>
                  </dd>
                </div>
              </>
            )}
            {/* Excess/refund details - gated on old_jewellery_excess, which
                is only non-null when old jewellery exceeded the bill.
                Remarks are included deliberately - since the old-purchase
                receipt link was removed from this page earlier, this is
                currently the only place an admin can see that internal
                note from the invoice screen. */}
            {invoice.old_jewellery_excess ? (
              <>
                <div className="flex justify-between border-t border-border pt-2">
                  <dt className="text-muted-foreground">Excess Refunded</dt>
                  <dd className="text-foreground">{formatInr(invoice.old_jewellery_excess.amount)}</dd>
                </div>
                {invoice.old_jewellery_excess.refund ? (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Refund Mode</dt>
                      <dd className="text-foreground">{invoice.old_jewellery_excess.refund.mode}</dd>
                    </div>
                    {invoice.old_jewellery_excess.refund.reference ? (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Refund Reference</dt>
                        <dd className="text-foreground">{invoice.old_jewellery_excess.refund.reference}</dd>
                      </div>
                    ) : null}
                    {invoice.old_jewellery_excess.refund.remarks ? (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Refund Notes</dt>
                        <dd className="text-foreground">{invoice.old_jewellery_excess.refund.remarks}</dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
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
          // Live mirror of addPayment()'s own server-side check
          // (paid_amount > grandTotal - exchangeApplied, i.e. the pending
          // balance) - catches it before Save Payment is even clickable,
          // instead of only finding out via a toast after a 422.
          // Math.round(invoice.pending_amount), not the raw value - matches
          // exactly what "Pay remaining" itself fills in (PaymentPanel's
          // own shortcut button already rounds grandTotal), so clicking
          // that shortcut can never trigger this warning against itself,
          // even for a legacy invoice whose stored pending_amount carries
          // paise from before payments were restricted to whole rupees.
          error={
            draftPayment && draftPayment.amount > Math.round(invoice.pending_amount)
              ? `Amount exceeds the pending balance of ${formatInr(invoice.pending_amount)}`
              : undefined
          }
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCollectOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCollect}
            disabled={
              !draftPayment ||
              draftPayment.amount <= 0 ||
              draftPayment.amount > Math.round(invoice.pending_amount) ||
              addPayment.isPending
            }
          >
            {addPayment.isPending ? "Saving…" : "Save Payment"}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteReason("");
        }}
        title="Delete invoice?"
      >
        <p className="text-sm text-muted-foreground">
          Delete <span className="font-medium text-foreground">{invoice.invoice_no}</span>? This can&apos;t be
          undone from here. Any tag-linked items become sellable again, and the invoice is hidden from every
          list, dashboard figure, and customer history - but the record itself is kept, not erased, along with
          the reason below.
          {/* invoice.old_jewellery_items.length > 0, not hasExchange - the
              server's own check (deleteInvoiceCascade) is based on
              linkedOldPurchaseId, not exchange_applied, so this warning
              must match that: a 100%-excess exchange (exchange_applied 0,
              everything settled as refund) still has linked old jewellery
              items the server will act on, even though hasExchange would
              be false for it. */}
          {invoice.old_jewellery_items.length > 0 ? (
            <>
              {" "}
              The linked old jewellery exchange will also be undone, as long as every item is still in the shop
              - if any item has already been disposed or melted, this delete will be blocked instead.
            </>
          ) : null}
          {invoice.paid_amount > 0 ? (
            <> Payments already recorded on this invoice are kept as-is - no refund is tracked automatically.</>
          ) : null}
        </p>
        <div className="mt-4">
          <Label htmlFor="delete-reason">Reason *</Label>
          <Input
            id="delete-reason"
            autoFocus
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Why is this invoice being deleted?"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDeleteOpen(false);
              setDeleteReason("");
            }}
            disabled={deleteInvoice.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={!deleteReason.trim() || deleteInvoice.isPending}
          >
            {deleteInvoice.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
