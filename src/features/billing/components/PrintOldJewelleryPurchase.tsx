"use client";

import { useOldPurchaseDetail } from "@/features/dashboard/hooks/useOldPurchaseDetail";
import { shopConfig } from "@/lib/shop-config";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";

const MODE_LABELS: Record<"cash" | "upi" | "bank_transfer", string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
};

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatWt(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// A4 portrait, not landscape - this table has fewer columns than the sales
// invoice's (no HSN/Tag/Pcs/Making/Stone Charge), so it fits comfortably
// without the extra width. English-only, per docs/old-jewellery-exchange-plan.md's
// Step 6 scope decision - nothing requires every print document in this
// app to support the sales invoice's bilingual toggle.
const PAGE_WIDTH = "210mm";

export interface PrintOldJewelleryPurchaseProps {
  id: string;
}

// Self-contained, same convention as PrintInvoice.tsx - fetches, renders
// loading/error states, owns the Print button, mountable from any page
// with just an id.
export function PrintOldJewelleryPurchase({ id }: PrintOldJewelleryPurchaseProps) {
  const { data: purchase, isLoading, isError } = useOldPurchaseDetail(id);

  if (isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }
  if (isError || !purchase) {
    return <p className="p-8 text-sm text-destructive">Could not load this purchase.</p>;
  }

  const grossWtTotal = purchase.items.reduce((sum, item) => sum + item.gross_wt_g, 0);
  const netWtTotal = purchase.items.reduce((sum, item) => sum + item.net_wt_g, 0);
  const valueTotal = purchase.items.reduce((sum, item) => sum + item.final_value, 0);

  return (
    <>
      <style>{"@page { size: A4 portrait; margin: 10mm; }"}</style>

      <div className="flex justify-center bg-muted/40 py-6 print:bg-white print:p-0">
        <div style={{ width: PAGE_WIDTH }}>
          {/* Controls - never printed */}
          <div className="print:hidden mb-3 flex items-center justify-end">
            <Button onClick={() => window.print()}>Print Receipt</Button>
          </div>

          <div
            style={{ fontFamily: "'Inter',sans-serif", color: "#1f1a12", background: "#fbf8f1" }}
            className="flex flex-col border-[1.5px] border-[#1f1a12]"
          >
            {/* Header */}
            <div className="relative border-b-2 border-[#1f1a12] px-6 py-4 text-center">
              <img src="/logo.png" alt="" className="absolute left-6 top-3 h-14 w-14 object-contain" />
              <div className="mb-1.5 text-[10px] font-semibold tracking-[0.28em]" style={{ color: "#9a7b2f" }}>
                OLD JEWELLERY PURCHASE RECEIPT
              </div>
              <div className="text-[24px] font-bold leading-tight">{shopConfig.heritageLineEn}</div>
              <div className="mt-0.5 text-[24px] font-bold leading-tight">{shopConfig.legalNameEn}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {shopConfig.addressEn} &nbsp;·&nbsp; {shopConfig.phone}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">GSTIN: {shopConfig.gstin}</div>
            </div>

            {/* Seller / purchase meta */}
            <div className="grid grid-cols-2 border-b-[1.5px] border-[#1f1a12]">
              <div className="border-r-[1.5px] border-[#c9beac] px-6 py-3">
                <div className="mb-2 text-[10.5px] font-bold">Seller Details</div>
                <div className="grid grid-cols-[76px_1fr] gap-y-1.5 text-[11.5px]">
                  <div className="text-muted-foreground">Name</div>
                  <div className="font-semibold">{purchase.customer.name}</div>
                  <div className="text-muted-foreground">Phone</div>
                  <div className="font-semibold">{purchase.customer.phone}</div>
                  {purchase.customer.address ? (
                    <>
                      <div className="text-muted-foreground">Address</div>
                      <div className="font-semibold">{purchase.customer.address}</div>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="px-6 py-3">
                <div className="mb-2 text-[10.5px] font-bold">Purchase Details</div>
                <div className="grid grid-cols-[96px_1fr] gap-y-1.5 text-[11.5px]">
                  <div className="text-muted-foreground">Purchase No</div>
                  <div className="font-semibold">{purchase.purchase_no}</div>
                  <div className="text-muted-foreground">Date</div>
                  <div className="font-semibold">{new Date(purchase.created_at).toLocaleDateString("en-IN")}</div>
                  {purchase.linked_invoice_no ? (
                    <>
                      <div className="text-muted-foreground">Linked Invoice</div>
                      <div className="font-semibold">{purchase.linked_invoice_no}</div>
                    </>
                  ) : null}
                  <div className="text-muted-foreground">Status</div>
                  <div>
                    <Badge
                      variant="outline"
                      className={`border-transparent font-medium capitalize ${
                        !purchase.is_deleted
                          ? "bg-emerald-ink/10 text-emerald-ink"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {purchase.is_deleted ? "Cancelled" : "Active"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="px-6 py-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border-b-[1.5px] border-b-[#1f1a12] px-2 py-1.5 text-left text-[8.5px] font-semibold tracking-wide text-muted-foreground">
                      Sr
                    </th>
                    <th className="border-b-[1.5px] border-b-[#1f1a12] px-2 py-1.5 text-left text-[8.5px] font-semibold tracking-wide text-muted-foreground">
                      Description
                    </th>
                    <th className="border-b-[1.5px] border-b-[#1f1a12] px-2 py-1.5 text-left text-[8.5px] font-semibold tracking-wide text-muted-foreground">
                      Metal/Purity
                    </th>
                    <th className="border-b-[1.5px] border-b-[#1f1a12] px-2 py-1.5 text-right text-[8.5px] font-semibold tracking-wide text-muted-foreground">
                      Gross Wt (g)
                    </th>
                    <th className="border-b-[1.5px] border-b-[#1f1a12] px-2 py-1.5 text-right text-[8.5px] font-semibold tracking-wide text-muted-foreground">
                      Net Wt (g)
                    </th>
                    <th className="border-b-[1.5px] border-b-[#1f1a12] px-2 py-1.5 text-right text-[8.5px] font-semibold tracking-wide text-muted-foreground">
                      Rate/g
                    </th>
                    <th className="border-b-[1.5px] border-b-[#1f1a12] px-2 py-1.5 text-right text-[8.5px] font-semibold tracking-wide text-muted-foreground">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((item) => (
                    <tr key={item.sr_no}>
                      <td className="border-b border-[#e8e1d0] px-2 py-1.5 text-[10.5px]">{item.sr_no}</td>
                      <td className="border-b border-[#e8e1d0] px-2 py-1.5 text-[10.5px]">{item.description}</td>
                      <td className="border-b border-[#e8e1d0] px-2 py-1.5 text-[10.5px]">
                        {[item.metal, item.purity].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="border-b border-[#e8e1d0] px-2 py-1.5 text-right text-[10.5px] tabular-nums">
                        {formatWt(item.gross_wt_g)}
                      </td>
                      <td className="border-b border-[#e8e1d0] px-2 py-1.5 text-right text-[10.5px] tabular-nums">
                        {formatWt(item.net_wt_g)}
                      </td>
                      <td className="border-b border-[#e8e1d0] px-2 py-1.5 text-right text-[10.5px] tabular-nums">
                        {item.applied_rate_per_gram.toLocaleString("en-IN")}
                      </td>
                      <td className="border-b border-[#e8e1d0] px-2 py-1.5 text-right text-[10.5px] font-medium tabular-nums">
                        {formatInr(item.final_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td
                      colSpan={3}
                      className="border-t-[1.5px] border-t-[#1f1a12] px-2 py-1.5 text-right text-[10.5px] font-bold"
                    >
                      Total
                    </td>
                    <td className="border-t-[1.5px] border-t-[#1f1a12] px-2 py-1.5 text-right text-[10.5px] font-bold tabular-nums">
                      {formatWt(grossWtTotal)}
                    </td>
                    <td className="border-t-[1.5px] border-t-[#1f1a12] px-2 py-1.5 text-right text-[10.5px] font-bold tabular-nums">
                      {formatWt(netWtTotal)}
                    </td>
                    <td className="border-t-[1.5px] border-t-[#1f1a12]"></td>
                    <td className="border-t-[1.5px] border-t-[#1f1a12] px-2 py-1.5 text-right text-[10.5px] font-bold tabular-nums">
                      {formatInr(valueTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Settlement */}
            <div className="grid grid-cols-2 border-t-[1.5px] border-[#1f1a12]">
              <div className="border-r-[1.5px] border-[#c9beac] px-6 py-3.5">
                <div className="mb-2 text-[10.5px] font-bold">Settlement</div>
                <div className="grid grid-cols-[150px_1fr] gap-y-1.5 text-[11.5px]">
                  <div className="text-muted-foreground">Total Purchase Value</div>
                  <div className="text-right font-semibold tabular-nums">{formatInr(purchase.total_purchase_value)}</div>
                  <div className="text-muted-foreground">Applied to Invoice</div>
                  <div className="text-right font-semibold tabular-nums">
                    − {formatInr(purchase.applied_to_invoice)}
                  </div>
                  {purchase.excess_amount > 0 ? (
                    <>
                      <div className="text-muted-foreground">Excess</div>
                      <div className="text-right font-bold tabular-nums" style={{ color: "#8a3129" }}>
                        {formatInr(purchase.excess_amount)}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="px-6 py-3.5">
                {purchase.excess_settlement === "refund" && purchase.refund ? (
                  <>
                    <div className="mb-2 text-[10.5px] font-bold">Refund</div>
                    <div className="grid grid-cols-[96px_1fr] gap-y-1.5 text-[11.5px]">
                      <div className="text-muted-foreground">Amount</div>
                      <div className="font-semibold tabular-nums">{formatInr(purchase.refund.amount)}</div>
                      <div className="text-muted-foreground">Mode</div>
                      <div className="font-semibold">{MODE_LABELS[purchase.refund.mode]}</div>
                      {purchase.refund.reference ? (
                        <>
                          <div className="text-muted-foreground">Reference</div>
                          <div className="font-semibold">{purchase.refund.reference}</div>
                        </>
                      ) : null}
                      {purchase.refund.remarks ? (
                        <>
                          <div className="text-muted-foreground">Remarks</div>
                          <div className="font-semibold">{purchase.refund.remarks}</div>
                        </>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[9.5px] italic text-muted-foreground">
                      Manually confirmed as paid outside the software - not a bank-verified transfer.
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No excess to settle on this purchase.</p>
                )}
              </div>
            </div>

            {/* Signatures */}
            <div className="flex items-end justify-between border-t-[1.5px] border-[#1f1a12] px-6 py-4">
              <div className="w-[180px] border-t border-[#9a9385] pt-1.5 text-[11px] text-muted-foreground">
                Seller Signature
              </div>
              <div className="w-[240px] border-t border-[#9a9385] pt-1.5 text-right text-[11px] text-muted-foreground">
                For {shopConfig.legalNameEn}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
