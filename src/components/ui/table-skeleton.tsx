import { Skeleton } from "@/components/ui/skeleton"

// Single row-shaped skeleton reused by every table/grid's first-load state
// (ag-grid and shadcn `<Table>` alike) instead of each one inventing its
// own "Loading…" text or ad-hoc pulse bars.
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
