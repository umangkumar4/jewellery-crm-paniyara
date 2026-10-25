"use client";

import { Boxes, Gem, IndianRupee, Package, Receipt, Users, Wallet } from "lucide-react";
import { formatInr, formatWeight } from "@/lib/formatters";
import type { DashboardSummary } from "@/features/dashboard/hooks/useDashboardSummary";

export interface KpiTile {
  label: string;
  value: string;
  icon: typeof IndianRupee;
  badge?: string;
}

interface KpiTilesProps {
  summary?: DashboardSummary;
  isLoading: boolean;
  isError: boolean;
  rangeTiles?: (summary: DashboardSummary) => KpiTile[];
  snapshotTiles?: (summary: DashboardSummary) => KpiTile[];
}

const defaultRangeTiles = (summary: DashboardSummary): KpiTile[] => [
  { label: "Total Sales", value: formatInr(summary.total_sales), icon: IndianRupee },
  { label: "Invoices", value: String(summary.invoice_count), icon: Receipt },
  { label: "Items Sold", value: String(summary.items_sold), icon: Package },
  { label: "New Customers", value: String(summary.new_customers), icon: Users },
  { label: "Old Jewellery Purchases", value: String(summary.old_jewellery_purchase_count), icon: Gem },
  {
    label: "Old Jewellery Purchased Value",
    value: formatInr(summary.old_jewellery_purchased_value),
    icon: IndianRupee,
  },
];

// As-of-now snapshot - not scoped by the date range, kept visually separate.
const defaultSnapshotTiles = (summary: DashboardSummary): KpiTile[] => [
  { label: "Pending Amount", value: formatInr(summary.pending_amount), icon: Wallet, badge: "As of now" },
  {
    label: `Stock on Hand · ${formatWeight(summary.stock_on_hand.net_weight_g)}`,
    value: `${summary.stock_on_hand.count} pcs`,
    icon: Boxes,
    badge: "As of now",
  },
];

export function KpiTiles({
  summary,
  isLoading,
  isError,
  rangeTiles = defaultRangeTiles,
  snapshotTiles = defaultSnapshotTiles,
}: KpiTilesProps) {
  if (isLoading && !summary) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
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

  const tiles = [...rangeTiles(summary), ...snapshotTiles(summary)];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="panel p-4">
          <div className="flex items-center justify-between">
            <tile.icon className="h-5 w-5 text-gold" />
            {tile.badge && (
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {tile.badge}
              </span>
            )}
          </div>
          <div className="mt-3 text-xl font-semibold text-foreground">{tile.value}</div>
          <div className="text-xs text-muted-foreground">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}
