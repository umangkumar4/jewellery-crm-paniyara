"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, Printer } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
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
    <div className="flex h-full items-center gap-1">
      <Link
        href={`/invoices/${data.id}`}
        aria-label="View invoice"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Eye className="h-4 w-4" />
      </Link>
      <Link
        href={`/invoices/${data.id}/print`}
        target="_blank"
        aria-label="Print invoice"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Printer className="h-4 w-4" />
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
}

// Used by both /invoices and /dashboard - genuinely the same full ledger
// (list + date filter + pagination) either page needs, so one component is
// reused rather than duplicated, same as InvoiceTable.tsx's own
// customerId/title props exist to avoid a second copy for the customer
// detail page. InvoiceTable.tsx (shadcn Table, used by /customers/[id])
// is intentionally untouched - this is a separate rendering engine, not a
// replacement for it, until/unless asked to convert that page too.
export function InvoiceGrid({ customerId, title = "Invoices" }: InvoiceGridProps = {}) {
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);

  const [prevDate, setPrevDate] = useState(date);
  if (prevDate !== date) {
    setPrevDate(date);
    setPage(1);
  }

  const { data, isLoading, isError } = useInvoicesList({
    page,
    limit: LIMIT,
    date: date || undefined,
    customerId,
  });

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
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => p.data?.customer_name ?? "",
        valueGetter: (p) => p.data?.customer_name,
      },
      {
        headerName: "Phone",
        width: 180,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => p.data?.phone ?? "",
        valueGetter: (p) => p.data?.customer_name,
      },
      { field: "items_count", headerName: "Items", width: 90, headerClass: AG_GRID_HEADER_CLASS },
      {
        field: "grand_total",
        headerName: "Grand Total",
        width: 140,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value != null ? formatInr(p.value) : ""),
      },
      {
        field: "pending_amount",
        headerName: "Pending",
        width: 130,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value != null ? formatInr(p.value) : ""),
      },
      {
        headerName: "Status",
        width: 110,
        headerClass: AG_GRID_HEADER_CLASS,
        cellRenderer: StatusCell,
        valueGetter: (p) => p.data?.payment_status,
      },
      {
        field: "created_at",
        headerName: "Date",
        width: 120,
        headerClass: AG_GRID_HEADER_CLASS,
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString("en-IN") : ""),
      },
      {
        headerName: "Actions",
        width: 100,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-xl text-foreground">{title}</h3>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-48" />
      </div>

      <div className="mt-5">
        {isLoading && !data ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="py-6 text-center text-sm text-destructive">Failed to load invoices.</div>
        ) : !data || data.data.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No invoices yet.</div>
        ) : (
          <AgGridReact<InvoiceListRow>
            theme={agGridTheme}
            defaultColDef={AG_GRID_DEFAULT_COL_DEF}
            rowData={data.data}
            columnDefs={columnDefs}
            getRowId={(p) => p.data.id}
            domLayout="autoHeight"
            suppressCellFocus
            animateRows={false}
          />
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
