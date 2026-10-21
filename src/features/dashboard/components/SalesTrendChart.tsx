"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatInr } from "@/lib/formatters";
import type { SalesTrendPoint } from "@/features/dashboard/hooks/useSalesTrend";

interface SalesTrendChartProps {
  data?: SalesTrendPoint[];
  isLoading: boolean;
  isError: boolean;
}

export function SalesTrendChart({ data, isLoading, isError }: SalesTrendChartProps) {
  if (isLoading && !data) {
    return <div className="panel h-80 animate-pulse p-6" />;
  }

  if (isError || !data) {
    return <div className="panel p-6 text-center text-sm text-destructive">Failed to load sales trend.</div>;
  }

  const hasSales = data.some((point) => point.total_sales > 0);

  return (
    <div className="panel p-6">
      <h3 className="font-display text-xl text-foreground">Sales Trend</h3>
      {hasSales ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => value.slice(5)}
                stroke="var(--muted-foreground)"
                fontSize={12}
              />
              <YAxis
                tickFormatter={(value: number) => `₹${(value / 1000).toFixed(0)}k`}
                stroke="var(--muted-foreground)"
                fontSize={12}
                width={56}
              />
              <Tooltip
                formatter={(value) => formatInr(Number(value))}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                }}
              />
              <Line
                type="monotone"
                dataKey="total_sales"
                stroke="var(--color-chart-1)"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-4 flex h-72 items-center justify-center text-sm text-muted-foreground">
          No sales in this range.
        </div>
      )}
    </div>
  );
}
