"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import { ApiError } from "@/lib/api-client";
import { useCustomers } from "@/features/customers/hooks/useCustomers";
import type { CustomerListRow } from "@/features/customers/hooks/useCustomers";

const LIMIT = 20;

function ActionCell({ data }: ICellRendererParams<CustomerListRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full items-center">
      <Link
        href={`/customers/${data.id}`}
        aria-label={`View ${data.name}`}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Eye className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function CustomersTable() {
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when the search term changes - adjusted during render
  // (React's recommended pattern for derived state), same as TagsTable.tsx.
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setPage(1);
  }

  const { data, isLoading, isError, error } = useCustomers({ page, limit: LIMIT, q: q || undefined });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const columnDefs = useMemo<ColDef<CustomerListRow>[]>(
  () => [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      headerClass: AG_GRID_HEADER_CLASS,
      cellClass: "font-medium",
    },
    {
      field: "phone",
      headerName: "Phone",
      flex: 1,
      headerClass: AG_GRID_HEADER_CLASS,
    },
    {
      headerName: "Email",
      flex: 1,
      headerClass: AG_GRID_HEADER_CLASS,
      valueGetter: (p) => p.data?.email || "—",
    },
    {
      field: "created_at",
      headerName: "Member Since",
      flex: 1,
      headerClass: AG_GRID_HEADER_CLASS,
      valueFormatter: (p) =>
        p.value ? new Date(p.value).toLocaleDateString("en-IN") : "",
    },
    {
      headerName: "Action",
      flex: 1,
      headerClass: `${AG_GRID_HEADER_CLASS}`,
      cellRenderer: ActionCell,
      sortable: false,
      filter: false,
    },
  ],
  [],
);

  return (
    <div className="panel p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-xl text-foreground">Customers</h3>
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or phone"
          leadingIcon={<Search className="h-4 w-4" />}
          className="sm:w-64"
        />
      </div>

      <div className="mt-5">
        {isLoading && !data ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="py-6 text-center text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Failed to load customers."}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {q ? "No customers match this search." : "No customers yet."}
          </div>
        ) : (
          <AgGridReact<CustomerListRow>
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
