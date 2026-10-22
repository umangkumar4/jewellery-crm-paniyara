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
// px widths did. 8 columns - no per-row GST/tax-inclusive-total column:
// every item shows its stored pre-tax Amount only, GST/CGST/SGST is a
// single invoice-level breakdown in the footer (already fully stored),
// never computed per row.
const COL_WIDTHS = {
  sr: "4%",
  description: "32%",
  hsn: "8%",
  pcs: "6%",
  netWt: "14%",
  rate: "12%",
  mkgStone: "12%",
  amount: "12%",
};

const cellBase = "border border-[#c9beac] px-1.5 py-1.5 text-[10.5px]";
const headBase =
  "border border-[#c9beac] border-t-[1.5px] border-t-[#1f1a12] px-1.5 py-1.5 text-left text-[8.5px] font-semibold tracking-wide text-muted-foreground";

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

  const shopNameBig = isHi ? shopConfig.legalNameHi : shopConfig.legalNameEn;
  const shopNameSmall = isHi ? shopConfig.legalNameEn : shopConfig.legalNameHi;
  const shopAddress = isHi ? shopConfig.addressHi : shopConfig.addressEn;

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

  const netWtTotal = invoice.items.reduce((sum, item) => sum + item.net_wt_g, 0);
  const mkgStoneTotal = invoice.items.reduce(
    (sum, item) => sum + item.making_charge + item.stone_charge,
    0,
  );
  const amountTotal = invoice.items.reduce((sum, item) => sum + item.total, 0);

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
              <div className="mb-1.5 text-[10px] font-semibold tracking-[0.28em]" style={{ color: "#9a7b2f" }}>
                {t.taxInvoice}
              </div>
              <div style={{ fontFamily: displayFont }} className="text-[28px] font-bold leading-tight">
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
            <div className="px-7 pt-3.5">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: COL_WIDTHS.sr }} />
                  <col style={{ width: COL_WIDTHS.description }} />
                  <col style={{ width: COL_WIDTHS.hsn }} />
                  <col style={{ width: COL_WIDTHS.pcs }} />
                  <col style={{ width: COL_WIDTHS.netWt }} />
                  <col style={{ width: COL_WIDTHS.rate }} />
                  <col style={{ width: COL_WIDTHS.mkgStone }} />
                  <col style={{ width: COL_WIDTHS.amount }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#f1e9d8" }}>
                    <th className={headBase}>{t.tableHeaders.sr}</th>
                    <th className={headBase}>{t.tableHeaders.description}</th>
                    <th className={headBase}>{t.tableHeaders.hsn}</th>
                    <th className={`${headBase} text-center`}>{t.tableHeaders.pcs}</th>
                    <th className={`${headBase} text-right`}>{t.tableHeaders.netWt}</th>
                    <th className={`${headBase} text-right`}>{t.tableHeaders.ratePerGram}</th>
                    <th className={`${headBase} text-right`}>{t.tableHeaders.makingStone}</th>
                    <th className={`${headBase} text-right border-r-[1.5px] border-r-[#1f1a12]`}>
                      {t.tableHeaders.amount}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => {
                    const purityText = item.purity ? `${item.metal} · ${item.purity}` : item.metal;
                    return (
                      <tr key={item.sr_no}>
                        <td className={`${cellBase} border-l-[1.5px] border-l-[#1f1a12]`}>{item.sr_no}</td>
                        <td className={cellBase}>
                          <div className="font-medium">{item.description}</div>
                          <div className="text-[9.5px] text-muted-foreground">{purityText}</div>
                        </td>
                        <td className={cellBase}>{item.hsn_code}</td>
                        <td className={`${cellBase} text-center`}>{item.pieces}</td>
                        <td className={`${cellBase} text-right tabular-nums`}>
                          <div>{formatWt(item.net_wt_g)}</div>
                          <div className="text-[9.5px] text-muted-foreground">
                            G {formatWt(item.gross_wt_g)} · S {formatWt(item.stone_wt_g)}
                          </div>
                        </td>
                        <td className={`${cellBase} text-right tabular-nums`}>{formatInr(item.rate_per_gram)}</td>
                        <td className={`${cellBase} text-right tabular-nums`}>
                          {formatInr(item.making_charge + item.stone_charge)}
                        </td>
                        <td
                          className={`${cellBase} text-right font-semibold tabular-nums border-r-[1.5px] border-r-[#1f1a12]`}
                        >
                          {formatInr(item.total)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "#f1e9d8" }}>
                    <td
                      colSpan={4}
                      className={`${cellBase} border-b-[1.5px] border-b-[#1f1a12] border-l-[1.5px] border-l-[#1f1a12] font-bold`}
                    >
                      {t.subTotal}
                    </td>
                    <td className={`${cellBase} border-b-[1.5px] border-b-[#1f1a12] text-right font-bold tabular-nums`}>
                      {formatWt(netWtTotal)}
                    </td>
                    <td className={`${cellBase} border-b-[1.5px] border-b-[#1f1a12]`}></td>
                    <td className={`${cellBase} border-b-[1.5px] border-b-[#1f1a12] text-right font-bold tabular-nums`}>
                      {formatInr(mkgStoneTotal)}
                    </td>
                    <td
                      className={`${cellBase} border-b-[1.5px] border-b-[#1f1a12] border-r-[1.5px] border-r-[#1f1a12] text-right font-bold tabular-nums`}
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
                    <div className="text-muted-foreground">{t.amountPaid}</div>
                    <div className="font-semibold tabular-nums">{formatInr(invoice.paid_amount)}</div>
                    <div className="text-muted-foreground">{t.balanceDue}</div>
                    <div className="font-bold tabular-nums" style={{ color: "#8a3129" }}>
                      {formatInr(invoice.pending_amount)}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 text-[9.5px] italic text-muted-foreground">{t.termsNote}</div>
              </div>
              <div className="grid grid-cols-[1fr_auto] text-[11.5px]">
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-muted-foreground">{t.taxableAmount}</div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-right font-semibold tabular-nums">
                  {formatInr(taxableAmount)}
                </div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-muted-foreground">
                  {t.cgst} ({invoice.cgst_percent ?? "—"}%)
                </div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-right font-semibold tabular-nums">
                  {formatInr(invoice.cgst_amount)}
                </div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-muted-foreground">
                  {t.sgst} ({invoice.sgst_percent ?? "—"}%)
                </div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-right font-semibold tabular-nums">
                  {formatInr(invoice.sgst_amount)}
                </div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-muted-foreground">{t.discount}</div>
                <div className="border-b border-[#c9beac] px-4 py-1.5 text-right font-semibold tabular-nums">
                  − {formatInr(invoice.discount_amount)}
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
