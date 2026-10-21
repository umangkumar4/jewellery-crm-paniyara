"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useInvoicesList } from "@/features/dashboard/hooks/useInvoicesList";
import type { InvoiceListRow } from "@/features/dashboard/hooks/useInvoicesList";

const LIMIT = 20;

const STATUS_BADGE: Record<InvoiceListRow["payment_status"], string> = {
  unpaid: "bg-destructive/10 text-destructive",
  partial: "bg-gold/20 text-gold-foreground",
  paid: "bg-emerald-ink/10 text-emerald-ink",
};

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// No delete action here, intentionally - DELETE /api/invoices/:id exists on
// the backend but is never linked from the UI (docs/billing-plan.md decision 5).
export function InvoiceTable() {
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);

  const [prevDate, setPrevDate] = useState(date);
  if (prevDate !== date) {
    setPrevDate(date);
    setPage(1);
  }

  const { data, isLoading, isError } = useInvoicesList({ page, limit: LIMIT, date: date || undefined });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="panel p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-xl text-foreground">Invoices</h3>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-48" />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-2 pr-3 font-medium">Invoice No</th>
              <th className="py-2 pr-3 font-medium">Customer</th>
              <th className="py-2 pr-3 font-medium">Items</th>
              <th className="py-2 pr-3 font-medium">Grand Total</th>
              <th className="py-2 pr-3 font-medium">Pending</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-destructive">
                  Failed to load invoices.
                </td>
              </tr>
            ) : data?.data.length ? (
              data.data.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium text-foreground">{invoice.invoice_no}</td>
                  <td className="py-2 pr-3">
                    <div className="text-foreground">{invoice.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{invoice.phone}</div>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{invoice.items_count}</td>
                  <td className="py-2 pr-3 text-foreground">{formatInr(invoice.grand_total)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{formatInr(invoice.pending_amount)}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[invoice.payment_status]}`}>
                      {invoice.payment_status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {new Date(invoice.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        aria-label="View invoice"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/invoices/${invoice.id}/print`}
                        target="_blank"
                        aria-label="Print invoice"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Printer className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted-foreground">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages} ({total} total)
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
