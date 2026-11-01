"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoaderOverlay } from "@/components/ui/Loader";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import {
  buildDateRangePresets,
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


function StatusCell({ data }: ICellRendererParams<InvoiceListRow>) {
  if (!data) return null;
  return (
    <Badge
      variant="outline"
      className={`border-transparent font-medium capitalize ${STATUS_BADGE[data.payment_status]}`}
    >
      {data.payment_status}
    </Badge>
  );
}

function ActionsCell({ data }: ICellRendererParams<InvoiceListRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Link
        href={`/invoices/${data.id}`}
        aria-label="View invoice"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Eye className="h-4 w-4" />
      </Link>
    </div>
  );
}

interface InvoiceGridProps {
  // When set, scopes the ledger to one customer's invoices - not used by
  // either current caller (/invoices or /dashboard), but mirrors the same
  // optional prop InvoiceTable.tsx (the shadcn-table version used on
  // /customers/[id]) already has, in case this grid is ever reused there.
  customerId?: string;
  title?: string;
  // When set, the grid's date filtering is driven by this value instead of
  // its own internal range state, and its own date-filter UI (the "Filter
  // by date" button / picker / clear button) is hidden - used by the
  // dashboard page, which already has its own top-level DateRangeFilter and
  // would otherwise show two separate, unsynced date filters for the same
  // ledger. /invoices (no dateRange passed) keeps managing its own range.
  dateRange?: DateRange;
}

// Used by both /invoices and /dashboard - genuinely the same full ledger
// (list + status filter + pagination) either page needs, so one component
// is reused rather than duplicated, same as InvoiceTable.tsx's own
// customerId/title props exist to avoid a second copy for the customer
// detail page. InvoiceTable.tsx (shadcn Table, used by /customers/[id])
// is intentionally untouched - this is a separate rendering engine, not a
// replacement for it, until/unless asked to convert that page too. Date
// filtering is the one thing that differs per caller: /invoices manages its
// own range (see `dateRange` prop doc above), /dashboard passes its own
// top-level DateRangeFilter's range down instead.
export function InvoiceGrid({ customerId, title = "Invoices", dateRange }: InvoiceGridProps = {}) {
  const router = useRouter();
  const isDateControlledExternally = dateRange !== undefined;

  // Defaults to today's invoices. Only used when dateRange isn't passed in -
  // see isDateControlledExternally below. null = "All time" - no UI control
  // sets this anymore (the clear button was removed), kept as a valid state
  // only so the type/ternary below still compiles without a wider change.
  const [internalRange, setInternalRange] = useState<DateRange | null>(rangeForPreset("today"));
  const range = isDateControlledExternally ? dateRange : internalRange;
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [prevFilters, setPrevFilters] = useState({ from: range?.from, to: range?.to, status, q });
  if (
    prevFilters.from !== range?.from ||
    prevFilters.to !== range?.to ||
    prevFilters.status !== status ||
    prevFilters.q !== q
  ) {
    setPrevFilters({ from: range?.from, to: range?.to, status, q });
    setPage(1);
  }

  const { data, isLoading, isFetching, isError } = useInvoicesList({
    page,
    limit: LIMIT,
    from: range?.from,
    to: range?.to,
    customerId,
    status: status === "all" ? undefined : status,
    q: q || undefined,
  });

  const dateRangePresets = useMemo(() => buildDateRangePresets(), []);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const columnDefs = useMemo<ColDef<InvoiceListRow>[]>(
    // Fixed widths, not flex - flex forces every column to shrink to fit
    // the panel's width, truncating header text ("Grand Total" becomes
    // "G..."). Fixed widths let every header stay fully readable; the grid
    // scrolls horizontally instead.
    () => [
      { field: "invoice_no", headerName: "Invoice No", width: 140, headerClass: AG_GRID_HEADER_CLASS },
      {
        headerName: "Name",
        width: 180,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => p.data?.customer_name ?? "",
        valueGetter: (p) => p.data?.customer_name,
      },
      {
        headerName: "Phone",
        width: 180,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => p.data?.phone ?? "",
        valueGetter: (p) => p.data?.customer_name,
      },
      { field: "items_count", headerName: "Items",  flex : 1 , width: 90, headerClass: AG_GRID_HEADER_CLASS },
      {
        field: "grand_total",
        headerName: "Grand Total",
        width: 140,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value != null ? formatInr(p.value) : ""),
      },
      {
        field: "pending_amount",
        headerName: "Pending",
        width: 130,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value != null ? formatInr(p.value) : ""),
      },
      {
        headerName: "Status",
        width: 110,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        cellRenderer: StatusCell,
        valueGetter: (p) => p.data?.payment_status,
      },
      {
        field: "created_at",
        headerName: "Date",
        width: 120,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString("en-IN") : ""),
      },
      {
        headerName: "Actions",
        width: 100,
        flex: 1,
        headerClass: AG_GRID_HEADER_CLASS,
        cellRenderer: ActionsCell,
        sortable: false,
        filter: false,
      },
    ],
    [],
  );

  return (
    <div className="panel p-6">
      <h3 className="font-display text-xl text-foreground">{title}</h3>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
           <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by invoice number"
            leadingIcon={<Search className="h-4 w-4" />}
            className="sm:w-60"
          />
          <Tabs value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <TabsList>
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className={tab.activeClass}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

        </div>

        {isDateControlledExternally ? null : range ? (
          <DateRangePicker
            value={{ from: fromDateKey(range.from), to: fromDateKey(range.to) }}
            onChange={(next) => setInternalRange({ from: toDateKey(next.from), to: toDateKey(next.to) })}
            presets={dateRangePresets}
            defaultPresetKey="today"
          />
        ) : (
          <Button type="button" variant="outline" onClick={() => setInternalRange(rangeForPreset("today"))}>
            <CalendarRange className="h-4 w-4" />
            Filter by date
          </Button>
        )}
      </div>

      <div className="relative mt-5">
        {isLoading && !data ? (
          <TableSkeleton rows={6} />
        ) : isError ? (
          <div className="py-12 text-center text-sm text-destructive">Failed to load invoices.</div>
        ) : !data || data.data.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {range || status !== "all" || q ? "No invoices match the current filters." : "No invoices yet."}
          </div>
        ) : (
          <>
            {isFetching && <LoaderOverlay />}
            <AgGridReact<InvoiceListRow>
              theme={agGridTheme}
              defaultColDef={AG_GRID_DEFAULT_COL_DEF}
              rowData={data.data}
              columnDefs={columnDefs}
              getRowId={(p) => p.data.id}
              domLayout="autoHeight"
              suppressCellFocus
              animateRows={false}
              rowClass="cursor-pointer"
              onRowClicked={(e) => {
                if (e.data) router.push(`/invoices/${e.data.id}`);
              }}
            />
          </>
        )}
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
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
