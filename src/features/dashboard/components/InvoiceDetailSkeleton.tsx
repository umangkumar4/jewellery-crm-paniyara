import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/table-skeleton";

// Mirrors the real invoice-detail page's layout (header, Customer/Items/
// Payments column, Totals sidebar - see src/app/(app)/invoices/[id]/page.tsx)
// so the loading state lines up with the loaded page instead of jumping.
export function InvoiceDetailSkeleton() {
  return (
    <div className="mx-2 max-w-full">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="panel p-6 md:col-span-2">
          <Skeleton className="h-5 w-24" />
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-12" />
                <Skeleton className="mt-1.5 h-4 w-20" />
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <Skeleton className="h-5 w-16" />
            <div className="mt-3">
              <TableSkeleton rows={4} />
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <Skeleton className="h-5 w-20" />
            <div className="mt-3">
              <TableSkeleton rows={2} />
            </div>
          </div>
        </div>

        <div className="panel p-6">
          <Skeleton className="h-5 w-16" />
          <div className="mt-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
