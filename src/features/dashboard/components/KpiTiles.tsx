"use client";

import {
  Boxes,
  IndianRupee,
  Package,
  Receipt,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInr, formatWeight } from "@/lib/formatters";
import type { DashboardSummary } from "@/features/dashboard/hooks/useDashboardSummary";

interface KpiTilesProps {
  summary?: DashboardSummary;
  isLoading: boolean;
  isError: boolean;
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs font-medium text-muted-foreground">—</span>;
  }
  const isUp = pct >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isUp ? "text-emerald-ink" : "text-destructive",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(pct)}%
    </span>
  );
}

interface RangeTile {
  label: string;
  value: string;
  icon: typeof IndianRupee;
  pct?: number | null;
}

export function KpiTiles({ summary, isLoading, isError }: KpiTilesProps) {
  if (isLoading && !summary) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="panel h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="panel p-6 text-center text-sm text-destructive">Failed to load dashboard summary.</div>
    );
  }

  const rangeTiles: RangeTile[] = [
    {
      label: "Total Sales",
      value: formatInr(summary.total_sales),
      icon: IndianRupee,
      pct: summary.vs_previous_period.total_sales_pct,
    },
    {
      label: "Invoices",
      value: String(summary.invoice_count),
      icon: Receipt,
      pct: summary.vs_previous_period.invoice_count_pct,
    },
    { label: "Items Sold", value: String(summary.items_sold), icon: Package },
    { label: "Net Weight Sold", value: formatWeight(summary.net_weight_sold_g), icon: Scale },
    { label: "Avg Invoice Value", value: formatInr(summary.avg_invoice_value), icon: TrendingUp },
    { label: "New Customers", value: String(summary.new_customers), icon: Users },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {rangeTiles.map((tile) => (
          <div key={tile.label} className="panel p-4">
            <div className="flex items-center justify-between">
              <tile.icon className="h-5 w-5 text-gold" />
              {tile.pct !== undefined ? <TrendBadge pct={tile.pct} /> : null}
            </div>
            <div className="mt-3 text-xl font-semibold text-foreground">{tile.value}</div>
            <div className="text-xs text-muted-foreground">{tile.label}</div>
          </div>
        ))}
      </div>

      {/* As-of-now snapshot - not scoped by the date range, kept visually separate. */}
      <div className="grid grid-cols-2 gap-4 sm:w-1/2">
        <div className="panel p-4">
          <div className="flex items-center justify-between">
            <Wallet className="h-5 w-5 text-gold" />
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              As of now
            </span>
          </div>
          <div className="mt-3 text-xl font-semibold text-foreground">{formatInr(summary.pending_amount)}</div>
          <div className="text-xs text-muted-foreground">Pending Amount</div>
        </div>
        <div className="panel p-4">
          <div className="flex items-center justify-between">
            <Boxes className="h-5 w-5 text-gold" />
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              As of now
            </span>
          </div>
          <div className="mt-3 text-xl font-semibold text-foreground">{summary.stock_on_hand.count} pcs</div>
          <div className="text-xs text-muted-foreground">
            Stock on Hand · {formatWeight(summary.stock_on_hand.net_weight_g)}
          </div>
        </div>
      </div>
    </div>
  );
}
