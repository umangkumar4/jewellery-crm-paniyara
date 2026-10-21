"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { useCustomers } from "@/features/customers/hooks/useCustomers";

const LIMIT = 20;

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
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-auto py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Name
              </TableHead>
              <TableHead className="h-auto py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Phone
              </TableHead>
              <TableHead className="h-auto py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Email
              </TableHead>
              <TableHead className="h-auto py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Member Since
              </TableHead>
              <TableHead className="h-auto py-2 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableCell colSpan={5} className="py-6 text-center whitespace-normal text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableCell colSpan={5} className="py-6 text-center whitespace-normal text-destructive">
                  {error instanceof ApiError ? error.message : "Failed to load customers."}
                </TableCell>
              </TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableCell colSpan={5} className="py-6 text-center whitespace-normal text-muted-foreground">
                  {q ? "No customers match this search." : "No customers yet."}
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((customer) => (
                <TableRow key={customer.id} className="border-border/60">
                  <TableCell className="py-3 font-medium text-foreground">{customer.name}</TableCell>
                  <TableCell className="py-3 text-muted-foreground">{customer.phone}</TableCell>
                  <TableCell className="py-3 text-muted-foreground">{customer.email || "—"}</TableCell>
                  <TableCell className="py-3 text-muted-foreground">
                    {new Date(customer.created_at).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Link
                      href={`/customers/${customer.id}`}
                      aria-label={`View ${customer.name}`}
                      className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
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
