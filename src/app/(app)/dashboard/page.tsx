"use client";

import { useState } from "react";
import { DateRangeFilter, rangeForPreset, DEFAULT_PRESET } from "@/features/dashboard/components/DateRangeFilter";
import type { DateRange } from "@/features/dashboard/components/DateRangeFilter";
import { KpiTiles } from "@/features/dashboard/components/KpiTiles";
import { SalesTrendChart } from "@/features/dashboard/components/SalesTrendChart";
import { MetalRateCarousel } from "@/features/dashboard/components/MetalRateCarousel";
import { InvoiceTable } from "@/features/dashboard/components/InvoiceTable";
import { useDashboardSummary } from "@/features/dashboard/hooks/useDashboardSummary";
import { useSalesTrend } from "@/features/dashboard/hooks/useSalesTrend";

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(() => rangeForPreset(DEFAULT_PRESET)!);

  const summaryQuery = useDashboardSummary(range);
  const trendQuery = useSalesTrend(range);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-foreground">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">Today&apos;s rates, sales, and pending balances.</p>
      </div>

      <MetalRateCarousel />

      <DateRangeFilter onChange={setRange} />

      <KpiTiles
        summary={summaryQuery.data}
        isLoading={summaryQuery.isLoading}
        isError={summaryQuery.isError}
      />

      <SalesTrendChart data={trendQuery.data} isLoading={trendQuery.isLoading} isError={trendQuery.isError} />

      <InvoiceTable />
    </div>
  );
}
