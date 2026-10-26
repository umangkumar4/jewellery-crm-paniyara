"use client";

import { useState } from "react";
import { useInvoicePrintData } from "@/features/dashboard/hooks/useInvoiceDetail";
import { shopConfig } from "@/lib/shop-config";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import {
  invoicePrintLabels,
  paymentModeLabels,
  paymentStatusLabels,
  type PrintLang,
} from "@/features/billing/lib/invoicePrintLocale";

// cgst_percent/cgst_amount/sgst_percent/sgst_amount are optional at the
// schema level (see Invoice.model.ts) - nullish here means a document
// written outside the normal createInvoice() flow, not a real "₹0" amount,
// so it renders as "—" rather than crashing on undefined.toLocaleString().
function formatInr(value: number | null | undefined): string {
  if (value == null) return "—";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatWt(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// Same status->color mapping InvoiceTable.tsx/InvoiceGrid.tsx already use,
// reused here rather than inventing a second palette for the same concept.
const STATUS_BADGE: Record<"unpaid" | "partial" | "paid", string> = {
  unpaid: "bg-destructive/10 text-destructive",
  partial: "bg-gold/20 text-gold-foreground",
  paid: "bg-emerald-ink/10 text-emerald-ink",
};

// A4 landscape (297mm) minus the @page margin (10mm each side) below.
const PAGE_WIDTH = "277mm";

// Percentages of the table's own width, not the page - these are relative,
// so they structurally can't exceed 100% the way the first mockup's fixed
// px widths did. The only merged column is Description+Metal (metal/purity
// subtext folded under the item name) - Purity, Gross Wt, Stone Wt, Making
// Charge and Stone Charge are each their own column, matching the billing
// page's entry grid one-for-one except for that single merge and Tag (an
// internal reference, never shown on the printed bill). No per-row GST/
// tax-inclusive-total column: every item shows its stored pre-tax Amount
// only, GST/CGST/SGST is a single invoice-level breakdown in the footer
// (already fully stored), never computed per row.
const COL_WIDTHS = {
  sr: "3%",
  description: "15%",
  hsn: "6%",
  purity: "7%",
  pcs: "5%",
  grossWt: "8%",
  stoneWt: "8%",
  netWt: "8%",
  rate: "10%",
  making: "9%",
  stoneCharge: "9%",
  amount: "9%",
};

// Old Jewellery Exchange table - no HSN/Pcs/Making/Stone Charge (don't
// apply to a buy-back, see docs/old-jewellery-exchange-plan.md's Step 6
// scope decision), metal/purity are their own columns instead of folded
// into Description, and dust weight is unique to this table.
const OLD_COL_WIDTHS = {
  sr: "4%",
  description: "20%",
  metal: "9%",
  purity: "9%",
  grossWt: "9%",
  stoneWt: "9%",
  dustWt: "9%",
  netWt: "9%",
  rate: "11%",
  value: "11%",
};

// No vertical column dividers - a single light row-separator per cell
// (bottom edge only), not a boxed spreadsheet grid. The table already sits
// inside the document's own outer border, so it doesn't need a second frame.
const cellBase = "border-b border-[#e8e1d0] px-2 py-1.5 text-[10.5px]";
const headBase =
  "border-b-[1.5px] border-b-[#1f1a12] px-2 py-1.5 text-left text-[8.5px] font-semibold tracking-wide text-muted-foreground";

export interface PrintInvoiceProps {
  id: string;
}

// Self-contained: fetches, renders loading/error states, owns the EN/हिन्दी
// toggle and Print button, and lays out the whole bordered A4-landscape
// document - any page can mount <PrintInvoice id={someId} /> and get a
// complete, ready-to-print bill with nothing else required from the caller.
export function PrintInvoice({ id }: PrintInvoiceProps) {
  const { data: invoice, isLoading, isError } = useInvoicePrintData(id);
  const [lang, setLang] = useState<PrintLang>("en");

  if (isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }
  if (isError || !invoice) {
    return <p className="p-8 text-sm text-destructive">Could not load this invoice.</p>;
  }

  const t = invoicePrintLabels[lang];
  const isHi = lang === "hi";
  const bodyFont = isHi ? "'Noto Sans Devanagari','Inter',sans-serif" : "'Inter',sans-serif";
  const displayFont = isHi ? "'Noto Serif Devanagari',serif" : "'Cormorant Garamond',serif";

  // The invoice shows the shop's full registered name (proprietor + business
  // type combined), matching the physical shop board - legalNameHi/
  // legalNameHiSub stay split in shopConfig since the login page shows them
  // as two separately-styled lines; this is the one place they're combined.
  const shopFullNameHi = `${shopConfig.legalNameHi} ${shopConfig.legalNameHiSub}`;
  const shopNameBig = isHi ? shopFullNameHi : shopConfig.legalNameEn;
  const shopNameSmall = isHi ? shopConfig.legalNameEn : shopFullNameHi;
  const shopAddress = isHi ? shopConfig.addressHi : shopConfig.addressEn;
  const heritageLine = isHi ? shopConfig.heritageLineHi : shopConfig.heritageLineEn;

  const paymentModes = Array.from(new Set(invoice.payments.map((payment) => payment.mode)));
  const paymentModeText =
    paymentModes.length > 0
      ? paymentModes.map((mode) => paymentModeLabels[lang][mode]).join(", ")
      : t.noPayments;

  // Trivial display arithmetic on already-stored numbers, not business
  // math: subtracting two stored fields, and reconciling a residual -
  // never a second implementation of pricing/tax logic.
  const taxableAmount = invoice.subtotal - invoice.discount_amount;
  // gst_amount is optional at the schema level (Invoice.model.ts) - guarded
  // with ?? 0 so a document missing it still produces a real number here
  // instead of NaN, same reasoning as formatInr's own null guard below.
  const roundOff =
    Math.round((invoice.grand_total - (taxableAmount + (invoice.gst_amount ?? 0))) * 100) / 100;

  const grossWtTotal = invoice.items.reduce((sum, item) => sum + item.gross_wt_g, 0);
  const stoneWtTotal = invoice.items.reduce((sum, item) => sum + item.stone_wt_g, 0);
  const netWtTotal = invoice.items.reduce((sum, item) => sum + item.net_wt_g, 0);
  const makingTotal = invoice.items.reduce((sum, item) => sum + item.making_charge, 0);
  const stoneChargeTotal = invoice.items.reduce((sum, item) => sum + item.stone_charge, 0);
  const amountTotal = invoice.items.reduce((sum, item) => sum + item.total, 0);

  // Settlement against the bill, not a repricing - grand_total itself never
  // changes because of an exchange. exchange_applied (not the raw old
  // jewellery total) is what's actually subtracted here, since it's
  // already correctly capped at grand_total server-side
  // (min(oldJewelleryTotal, grandTotal)) - using the raw total instead
  // could go negative if the old jewellery was worth more than the bill
  // (the excess/refund case, settled separately, not shown here).
  // old_jewellery_items is embedded directly on the invoice response now
  // (invoicesService.ts's findOldJewelleryExchangeItems()) - no second
  // fetch to GET /api/old-purchases/:id needed just to render this table.
  const hasExchange = invoice.exchange_applied > 0 && invoice.old_jewellery_items.length > 0;
  const amountToPay = Math.max(0, invoice.grand_total - invoice.exchange_applied);
  const oldGrossWtTotal = invoice.old_jewellery_items.reduce((sum, item) => sum + item.gross_wt_g, 0);
  const oldStoneWtTotal = invoice.old_jewellery_items.reduce((sum, item) => sum + item.stone_wt_g, 0);
  const oldDustWtTotal = invoice.old_jewellery_items.reduce((sum, item) => sum + item.dust_wt_g, 0);
  const oldNetWtTotal = invoice.old_jewellery_items.reduce((sum, item) => sum + item.net_wt_g, 0);
  const oldValueTotal = invoice.old_jewellery_items.reduce((sum, item) => sum + item.final_value, 0);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap"
      />
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>

      <div className="flex justify-center bg-muted/40 py-6 print:bg-white print:p-0">
        <div style={{ width: PAGE_WIDTH }}>
          {/* Controls - never printed */}
          <div className="print:hidden mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex overflow-hidden rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-4 py-1.5 text-sm font-medium transition ${
                  lang === "en" ? "bg-foreground text-background" : "bg-background text-foreground hover:bg-muted"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang("hi")}
                className={`px-4 py-1.5 text-sm font-medium transition ${
                  lang === "hi" ? "bg-foreground text-background" : "bg-background text-foreground hover:bg-muted"
                }`}
              >
                हिन्दी
              </button>
            </div>
            <Button onClick={() => window.print()}>{t.printButton}</Button>
          </div>

          {/* Printable invoice */}
          <div
            style={{ fontFamily: bodyFont, color: "#1f1a12", background: "#fbf8f1" }}
            className="flex flex-col border-[1.5px] border-[#1f1a12]"
          >
            {/* Header */}
            <div className="relative border-b-2 border-[#1f1a12] px-7 py-5 text-center">
              <img
                src="/logo.png"
                alt=""
                className="absolute left-7 top-4 h-16 w-16 object-contain"
              />
              <div className="mb-1.5 text-[10px] font-semibold tracking-[0.28em]" style={{ color: "#9a7b2f" }}>
                {t.taxInvoice}
              </div>
              <div className="text-[10.5px] italic text-muted-foreground">{heritageLine}</div>
              <div style={{ fontFamily: displayFont }} className="mt-0.5 text-[28px] font-bold leading-tight">
                {shopNameBig}
              </div>
              <div style={{ fontFamily: displayFont }} className="mt-0.5 text-[14px] text-muted-foreground">
                {shopNameSmall}
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                {shopAddress} &nbsp;·&nbsp; {shopConfig.phone}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">GSTIN: {shopConfig.gstin}</div>
              <div
                className="absolute right-5 top-4 rounded border px-2 py-0.5 text-[9.5px] font-semibold tracking-wide"
                style={{ borderColor: "#9a7b2f", color: "#9a7b2f" }}
              >
                {t.langTag}
              </div>
            </div>

            {/* Bill to / invoice meta */}
            <div className="grid grid-cols-[1.3fr_1fr] border-b-[1.5px] border-[#1f1a12]">
              <div className="border-r-[1.5px] border-[#c9beac] px-7 py-3.5">
                <div className="mb-2 text-[10.5px] font-bold">{t.billTo}</div>
                <div className="grid grid-cols-[76px_1fr] gap-y-1.5 text-[11.5px]">
                  <div className="text-muted-foreground">{t.name}</div>
                  <div className="font-semibold">{invoice.customer.name}</div>
                  <div className="text-muted-foreground">{t.phone}</div>
                  <div className="font-semibold">{invoice.customer.phone}</div>
                  {invoice.customer.address ? (
                    <>
                      <div className="text-muted-foreground">{t.address}</div>
                      <div className="font-semibold">{invoice.customer.address}</div>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="px-7 py-3.5">
                <div className="mb-2 text-[10.5px] font-bold">{t.invoiceDetails}</div>
                <div className="grid grid-cols-[96px_1fr] gap-y-1.5 text-[11.5px]">
                  <div className="text-muted-foreground">{t.invoiceNo}</div>
                  <div className="font-semibold">{invoice.invoice_no}</div>
                  <div className="text-muted-foreground">{t.invoiceDate}</div>
                  <div className="font-semibold">
                    {new Date(invoice.created_at).toLocaleDateString("en-IN")}
                  </div>
                  <div className="text-muted-foreground">{t.paymentMode}</div>
                  <div className="font-semibold">{paymentModeText}</div>
                  <div className="text-muted-foreground">{t.status}</div>
                  <div>
                    <Badge
                      variant="outline"
                      className={`border-transparent font-medium capitalize ${STATUS_BADGE[invoice.payment_status]}`}
                    >
                      {paymentStatusLabels[lang][invoice.payment_status]}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="w-full">
              <table className="w-full table-fixed border-collapse" style={{ width: "100%" }}>
                <colgroup>
                  <col style={{ width: COL_WIDTHS.sr }} />
                  <col style={{ width: COL_WIDTHS.description }} />
                  <col style={{ width: COL_WIDTHS.hsn }} />
                  <col style={{ width: COL_WIDTHS.purity }} />
                  <col style={{ width: COL_WIDTHS.pcs }} />
                  <col style={{ width: COL_WIDTHS.grossWt }} />
                  <col style={{ width: COL_WIDTHS.stoneWt }} />
                  <col style={{ width: COL_WIDTHS.netWt }} />
                  <col style={{ width: COL_WIDTHS.rate }} />
                  <col style={{ width: COL_WIDTHS.making }} />
                  <col style={{ width: COL_WIDTHS.stoneCharge }} />
                  <col style={{ width: COL_WIDTHS.amount }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#f1e9d8" }}>
                    <th className={headBase}>{t.tableHeaders.sr}</th>
                    <th className={headBase}>{t.tableHeaders.description}</th>
                    <th className={headBase}>{t.tableHeaders.hsn}</th>
                    <th className={headBase}>{t.tableHeaders.purity}</th>
                    <th className={`${headBase} text-center`}>{t.tableHeaders.pcs}</th>
                    <th className={`${headBase} text-right`}>{t.tableHeaders.grossWt}</th>
                    <th className={`${headBase} text-right`}>{t.tableHeaders.stoneWt}</th>
                    <th className={`${headBase} text-right`}>{t.tableHeaders.netWt}</th>
                    <th className={`${headBase} text-right`}>{t.tableHeaders.ratePerGram}</th>
                    <th className={`${headBase} text-right`}>{t.tableHeaders.makingCharge}</th>
                    <th className={`${headBase} text-right`}>{t.tableHeaders.stoneCharge}</th>
                    <th className={`${headBase} text-right`}>{t.tableHeaders.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.sr_no}>
                      <td className={cellBase}>{item.sr_no}</td>
                      <td className={cellBase}>
                        <div className="font-medium">{item.description}</div>
                        <div className="text-[9.5px] text-muted-foreground">{item.metal}</div>
                      </td>
                      <td className={cellBase}>{item.hsn_code}</td>
                      <td className={cellBase}>{item.purity || "—"}</td>
                      <td className={`${cellBase} text-center`}>{item.pieces}</td>
                      <td className={`${cellBase} text-right tabular-nums`}>{formatWt(item.gross_wt_g)}</td>
                      <td className={`${cellBase} text-right tabular-nums`}>{formatWt(item.stone_wt_g)}</td>
                      <td className={`${cellBase} text-right tabular-nums`}>{formatWt(item.net_wt_g)}</td>
                      <td className={`${cellBase} text-right tabular-nums`}>{formatInr(item.rate_per_gram)}</td>
                      <td className={`${cellBase} text-right tabular-nums`}>{formatInr(item.making_charge)}</td>
                      <td className={`${cellBase} text-right tabular-nums`}>{formatInr(item.stone_charge)}</td>
                      <td className={`${cellBase} text-right font-semibold tabular-nums`}>
                        {formatInr(item.total)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f1e9d8" }}>
                    <td colSpan={5} className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] font-bold`}>
                      {t.subTotal}
                    </td>
                    <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] text-right font-bold tabular-nums`}>
                      {formatWt(grossWtTotal)}
                    </td>
                    <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] text-right font-bold tabular-nums`}>
                      {formatWt(stoneWtTotal)}
                    </td>
                    <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] text-right font-bold tabular-nums`}>
                      {formatWt(netWtTotal)}
                    </td>
                    <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12]`}></td>
                    <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] text-right font-bold tabular-nums`}>
                      {formatInr(makingTotal)}
                    </td>
                    <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] text-right font-bold tabular-nums`}>
                      {formatInr(stoneChargeTotal)}
                    </td>
                    <td
                      className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] text-right font-bold tabular-nums`}
                    >
                      {formatInr(amountTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex-1" />

            {/* Payment summary + totals */}
            <div className="grid grid-cols-[1.3fr_1fr] border-t-[1.5px] border-[#1f1a12]">
              <div className="flex flex-col justify-between border-r-[1.5px] border-[#c9beac] px-7 py-4">
                <div>
                  <div className="mb-2 text-[10.5px] font-bold">{t.paymentSummary}</div>
                  <div className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[11.5px]">
                    <div className="text-muted-foreground">{t.paymentMode}</div>
                    <div className="font-semibold">{paymentModeText}</div>
                  </div>
                </div>
                <div className="mt-2.5 text-[9.5px] italic text-muted-foreground">{t.termsNote}</div>
              </div>
              {/* Discount moved above Taxable Amount - previously sat after
                  CGST/SGST, so the taxable figure appeared before the line
                  explaining why it's lower than Subtotal. */}
              <div className="grid grid-cols-[1fr_auto] text-[11.5px]">
                <div className="border-b border-[#c9beac] bg-[#fdf4df] px-4 py-1.5 text-muted-foreground">
                  {t.discount}
                </div>
                <div className="border-b border-[#c9beac] bg-[#fdf4df] px-4 py-1.5 text-right font-semibold tabular-nums">
                  − {formatInr(invoice.discount_amount)}
                </div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-muted-foreground">{t.taxableAmount}</div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-right font-semibold tabular-nums">
                  {formatInr(taxableAmount)}
                </div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-muted-foreground">
                  {t.cgst} ({invoice.cgst_percent ?? "—"}%)
                </div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-right font-semibold tabular-nums">
                  + {formatInr(invoice.cgst_amount)}
                </div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-muted-foreground">
                  {t.sgst} ({invoice.sgst_percent ?? "—"}%)
                </div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-right font-semibold tabular-nums">
                  + {formatInr(invoice.sgst_amount)}
                </div>
                <div className="border-b-[1.5px] border-[#1f1a12] px-4 py-1.5 text-muted-foreground">
                  {t.roundOff}
                </div>
                <div className="border-b-[1.5px] border-[#1f1a12] px-4 py-1.5 text-right font-semibold tabular-nums">
                  {formatInr(roundOff)}
                </div>
                <div className="px-4 py-2.5 text-[14px] font-bold" style={{ background: "#f1e9d8" }}>
                  {t.grandTotal}
                </div>
                <div
                  className="px-4 py-2.5 text-right text-[14px] font-bold tabular-nums"
                  style={{ background: "#f1e9d8" }}
                >
                  {formatInr(invoice.grand_total)}
                </div>
              </div>
            </div>

            {/* Settlement - shown below Grand Total, which itself never
                changes because of an exchange (this is a settlement line
                against it, not a repricing). The Old Jewellery Exchange
                table only renders when this invoice actually has one;
                Amount Paid/Total Remaining always render, same as every
                ordinary invoice already needs them. */}
            <div className="border-t-[1.5px] border-[#1f1a12]"> 
              {hasExchange ? (
                <div className="mb-4">
                  {/* <div className="mb-2 text-[10.5px] font-bold">{t.oldJewelleryExchange}</div> */}
                  <table className="w-full table-fixed border-collapse">
                    <colgroup>
                      <col style={{ width: OLD_COL_WIDTHS.sr }} />
                      <col style={{ width: OLD_COL_WIDTHS.description }} />
                      <col style={{ width: OLD_COL_WIDTHS.metal }} />
                      <col style={{ width: OLD_COL_WIDTHS.purity }} />
                      <col style={{ width: OLD_COL_WIDTHS.grossWt }} />
                      <col style={{ width: OLD_COL_WIDTHS.stoneWt }} />
                      <col style={{ width: OLD_COL_WIDTHS.dustWt }} />
                      <col style={{ width: OLD_COL_WIDTHS.netWt }} />
                      <col style={{ width: OLD_COL_WIDTHS.rate }} />
                      <col style={{ width: OLD_COL_WIDTHS.value }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: "#f1e9d8" }}>
                        <th className={headBase}>{t.tableHeaders.sr}</th>
                        <th className={headBase}>{t.tableHeaders.description}</th>
                        <th className={headBase}>{t.tableHeaders.metal}</th>
                        <th className={headBase}>{t.tableHeaders.purity}</th>
                        <th className={`${headBase} text-right`}>{t.tableHeaders.grossWt}</th>
                        <th className={`${headBase} text-right`}>{t.tableHeaders.stoneWt}</th>
                        <th className={`${headBase} text-right`}>{t.tableHeaders.dustWt}</th>
                        <th className={`${headBase} text-right`}>{t.tableHeaders.netWt}</th>
                        <th className={`${headBase} text-right`}>{t.tableHeaders.ratePerGram}</th>
                        <th className={`${headBase} text-right`}>{t.tableHeaders.value}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.old_jewellery_items.map((item) => (
                        <tr key={item.sr_no}>
                          <td className={cellBase}>{item.sr_no}</td>
                          <td className={cellBase}>{item.description}</td>
                          <td className={cellBase}>{item.metal}</td>
                          <td className={cellBase}>{item.purity || "—"}</td>
                          <td className={`${cellBase} text-right tabular-nums`}>{formatWt(item.gross_wt_g)}</td>
                          <td className={`${cellBase} text-right tabular-nums`}>{formatWt(item.stone_wt_g)}</td>
                          <td className={`${cellBase} text-right tabular-nums`}>{formatWt(item.dust_wt_g)}</td>
                          <td className={`${cellBase} text-right tabular-nums`}>{formatWt(item.net_wt_g)}</td>
                          <td className={`${cellBase} text-right tabular-nums`}>
                            {formatInr(item.applied_rate_per_gram)}
                          </td>
                          <td className={`${cellBase} text-right font-semibold tabular-nums`}>
                            {formatInr(item.final_value)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: "#f1e9d8" }}>
                        <td colSpan={4} className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] font-bold`}>
                          {t.subTotal}
                        </td>
                        <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] text-right font-bold tabular-nums`}>
                          {formatWt(oldGrossWtTotal)}
                        </td>
                        <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] text-right font-bold tabular-nums`}>
                          {formatWt(oldStoneWtTotal)}
                        </td>
                        <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] text-right font-bold tabular-nums`}>
                          {formatWt(oldDustWtTotal)}
                        </td>
                        <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] text-right font-bold tabular-nums`}>
                          {formatWt(oldNetWtTotal)}
                        </td>
                        <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12]`}></td>
                        <td className={`${cellBase} border-t-[1.5px] border-t-[#1f1a12] text-right font-bold tabular-nums`}>
                          {formatInr(oldValueTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="ml-auto mt-2 grid grid-cols-[1fr_auto] text-[11.5px]" style={{ maxWidth: 360 }}>
                    <div className="px-4 py-1.5 text-muted-foreground">{t.oldJewelleryTotal}</div>
                    <div className="px-4 py-1.5 text-right font-semibold tabular-nums">
                      {formatInr(oldValueTotal)}
                    </div>
                    <div className="px-4 py-2 text-[13px] font-bold" style={{ background: "#f1e9d8" }}>
                      {t.amountToPay}
                    </div>
                    <div
                      className="px-4 py-2 text-right text-[13px] font-bold tabular-nums"
                      style={{ background: "#f1e9d8" }}
                    >
                      {formatInr(amountToPay)}
                    </div>
                  </div>
                  {/* Only when old jewellery exceeded the bill - plain-
                      English (or Hindi) explanation for the customer, not
                      a terse badge/label. remarks is deliberately never
                      rendered here - internal shop notes, not customer-
                      facing. reference only appears when present. */}
                  {invoice.old_jewellery_excess ? (
                    <div className="mt-2 text-[10px] leading-snug text-muted-foreground">
                      {t.excess.intro} ({formatInr(oldValueTotal)}) {t.excess.exceededBy}{" "}
                      {formatInr(invoice.old_jewellery_excess.amount)}
                      {t.excess.exceededBySuffix ? ` ${t.excess.exceededBySuffix}` : ""}.
                      {invoice.old_jewellery_excess.refund ? (
                        <>
                          {" "}
                          {t.excess.refundedVia}{" "}
                          {paymentModeLabels[lang][invoice.old_jewellery_excess.refund.mode]}.
                          {invoice.old_jewellery_excess.refund.reference
                            ? ` (${t.excess.referenceLabel}: ${invoice.old_jewellery_excess.refund.reference})`
                            : ""}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="ml-auto grid grid-cols-[1fr_auto] text-[11.5px]" style={{ maxWidth: 360 }}>
                <div className="px-4 py-1.5 text-muted-foreground">{t.amountPaid}</div>
                <div className="px-4 py-1.5 text-right font-semibold tabular-nums">
                  {formatInr(invoice.paid_amount)}
                </div>
                <div className="px-4 py-2 text-[13px] font-bold" style={{ color: "#8a3129" }}>
                  {t.totalRemaining}
                </div>
                <div className="px-4 py-2 text-right text-[13px] font-bold tabular-nums" style={{ color: "#8a3129" }}>
                  {formatInr(invoice.pending_amount)}
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="flex items-end justify-between border-t-[1.5px] border-[#1f1a12] px-7 py-4">
              <div className="w-[200px] border-t border-[#9a9385] pt-1.5 text-[11px] text-muted-foreground">
                {t.customerSignature}
              </div>
              <div className="w-[280px] border-t border-[#9a9385] pt-1.5 text-right text-[11px] text-muted-foreground">
                {t.forShop} {shopConfig.legalNameEn}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
