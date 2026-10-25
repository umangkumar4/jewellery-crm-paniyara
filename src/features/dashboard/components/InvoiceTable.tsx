"use client";

import { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Eye, Printer, X } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildDateRangePresets,
  DEFAULT_PRESET,
  fromDateKey,
  rangeForPreset,
  toDateKey,
  type DateRange,
} from "@/features/dashboard/components/DateRangeFilter";
import { useInvoicesList } from "@/features/dashboard/hooks/useInvoicesList";
import type { InvoiceListRow } from "@/features/dashboard/hooks/useInvoicesList";

const LIMIT = 20;

const STATUS_BADGE: Record<InvoiceListRow["payment_status"], string> = {
  unpaid: "bg-destructive/10 text-destructive",
  partial: "bg-gold/20 text-gold-foreground",
  paid: "bg-emerald-ink/10 text-emerald-ink",
};

type StatusFilter = "all" | InvoiceListRow["payment_status"];

// Mirrors STATUS_BADGE's colors so the active tab visually matches the same
// status's badge color in the Status column below. Written as full literal
// class strings (not built with template-literal concatenation) because
// Tailwind's scanner only picks up classes that appear verbatim in source.
const STATUS_TABS: { value: StatusFilter; label: string; activeClass: string }[] = [
  { value: "all", label: "All", activeClass: "data-[state=active]:bg-background" },
  {
    value: "unpaid",
    label: "Unpaid",
    activeClass: "data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive",
  },
  {
    value: "partial",
    label: "Partial",
    activeClass: "data-[state=active]:bg-gold/20 data-[state=active]:text-gold-foreground",
  },
  {
    value: "paid",
    label: "Paid",
    activeClass: "data-[state=active]:bg-emerald-ink/10 data-[state=active]:text-emerald-ink",
  },
];

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface InvoiceTableProps {
  // When set, scopes the ledger to one customer's invoices (reuses this
  // same component on the customer detail page instead of a duplicate
  // table - see docs/customers-plan.md). The table's own date filter
  // still applies on top, independently.
  customerId?: string;
  title?: string;
}

// No delete action here, intentionally - DELETE /api/invoices/:id exists on
// the backend but is never linked from the UI (docs/billing-plan.md decision 5).
export function InvoiceTable({ customerId, title = "Invoices" }: InvoiceTableProps = {}) {
  // null = "All time" (today's behavior: no date filter applied).
  const [range, setRange] = useState<DateRange | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [prevFilters, setPrevFilters] = useState({ from: range?.from, to: range?.to, status });
  if (prevFilters.from !== range?.from || prevFilters.to !== range?.to || prevFilters.status !== status) {
    setPrevFilters({ from: range?.from, to: range?.to, status });
    setPage(1);
  }

  const { data, isLoading, isError } = useInvoicesList({
    page,
    limit: LIMIT,
    from: range?.from,
    to: range?.to,
    customerId,
    status: status === "all" ? undefined : status,
  });

  const dateRangePresets = useMemo(() => buildDateRangePresets(), []);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="panel p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-xl text-foreground">{title}</h3>
        {range ? (
          <div className="flex items-center gap-2">
            <DateRangePicker
              value={{ from: fromDateKey(range.from), to: fromDateKey(range.to) }}
              onChange={(next) => setRange({ from: toDateKey(next.from), to: toDateKey(next.to) })}
              presets={dateRangePresets}
              defaultPresetKey={DEFAULT_PRESET}
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Clear date range" onClick={() => setRange(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setRange(rangeForPreset(DEFAULT_PRESET))}>
            <CalendarRange className="h-4 w-4" />
            Filter by date
          </Button>
        )}
      </div>

      <Tabs value={status} onValueChange={(value) => setStatus(value as StatusFilter)} className="mt-4">
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={tab.activeClass}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-5">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-auto py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Invoice No
              </TableHead>
              <TableHead className="h-auto py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Customer
              </TableHead>
              <TableHead className="h-auto py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Items
              </TableHead>
              <TableHead className="h-auto py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Grand Total
              </TableHead>
              <TableHead className="h-auto py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Pending
              </TableHead>
              <TableHead className="h-auto py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Status
              </TableHead>
              <TableHead className="h-auto py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Date
              </TableHead>
              <TableHead className="h-auto py-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableCell colSpan={8} className="py-6 text-center whitespace-normal text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableCell colSpan={8} className="py-6 text-center whitespace-normal text-destructive">
                  Failed to load invoices.
                </TableCell>
              </TableRow>
            ) : data?.data.length ? (
              data.data.map((invoice) => (
                <TableRow key={invoice.id} className="border-border/60">
                  <TableCell className="py-2 font-medium text-foreground">{invoice.invoice_no}</TableCell>
                  <TableCell className="py-2">
                    <div className="text-foreground">{invoice.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{invoice.phone}</div>
                  </TableCell>
                  <TableCell className="py-2 text-muted-foreground">{invoice.items_count}</TableCell>
                  <TableCell className="py-2 text-foreground">{formatInr(invoice.grand_total)}</TableCell>
                  <TableCell className="py-2 text-muted-foreground">
                    {formatInr(invoice.pending_amount)}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge
                      variant="outline"
                      className={`border-transparent font-medium capitalize ${STATUS_BADGE[invoice.payment_status]}`}
                    >
                      {invoice.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-muted-foreground">
                    {new Date(invoice.created_at).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell className="py-2">
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
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableCell colSpan={8} className="py-6 text-center whitespace-normal text-muted-foreground">
                  {range || status !== "all" ? "No invoices match the current filters." : "No invoices yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
