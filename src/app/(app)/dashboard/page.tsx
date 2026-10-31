"use client";

import { useState } from "react";
import { DashboardWelcomeBanner } from "@/features/dashboard/components/DashboardWelcomeBanner";
import { DateRangeFilter, rangeForPreset } from "@/features/dashboard/components/DateRangeFilter";
import type { DateRange } from "@/features/dashboard/components/DateRangeFilter";
import { KpiTiles } from "@/features/dashboard/components/KpiTiles";
import { SalesTrendChart } from "@/features/dashboard/components/SalesTrendChart";
import { MetalRateCarousel } from "@/features/dashboard/components/MetalRateCarousel";
import { InvoiceGrid } from "@/features/dashboard/components/InvoiceGrid";
import { useDashboardSummary } from "@/features/dashboard/hooks/useDashboardSummary";
import { useSalesTrend } from "@/features/dashboard/hooks/useSalesTrend";

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("today"));

  const summaryQuery = useDashboardSummary(range);
  const trendQuery = useSalesTrend(range);

  return (
    <div className="space-y-6">
      <DashboardWelcomeBanner />

      <MetalRateCarousel />

      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl text-foreground">Today Stats</h2>
        </div>
        <DateRangeFilter onChange={setRange} defaultPresetKey="today" />
      </div>

      <KpiTiles
        summary={summaryQuery.data}
        isLoading={summaryQuery.isLoading}
        isError={summaryQuery.isError}
      />
      <InvoiceGrid dateRange={range} />
      <SalesTrendChart data={trendQuery.data} isLoading={trendQuery.isLoading} isError={trendQuery.isError} />
    </div>
  );
}
