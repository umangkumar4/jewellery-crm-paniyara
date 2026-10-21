import { InvoiceModel } from "@/models/Invoice.model";
import { CustomerModel } from "@/models/Customer.model";
import { TagModel } from "@/models/Tag.model";
import { daysBetween } from "@/schemas/dashboard.schema";
import { businessDayStart, businessDayEnd } from "@/lib/business-time";

export interface DashboardRangeParams {
  from: string;
  to: string;
}

export interface DashboardSummary {
  from: string;
  to: string;
  total_sales: number;
  invoice_count: number;
  items_sold: number;
  net_weight_sold_g: number;
  avg_invoice_value: number;
  new_customers: number;
  vs_previous_period: {
    total_sales_pct: number | null;
    invoice_count_pct: number | null;
  };
  pending_amount: number;
  stock_on_hand: {
    count: number;
    net_weight_g: number;
  };
}

export interface SalesTrendPoint {
  date: string;
  total_sales: number;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// null (not Infinity/NaN) when the previous period had nothing to compare
// against - the frontend renders that as "-"/"new" rather than a bogus
// percentage.
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return roundTo(((current - previous) / previous) * 100, 1);
}

interface CurrentPeriodFacetRow {
  total_sales: number;
  invoice_count: number;
  items_sold: number;
  net_weight_sold_g: number;
}

interface PreviousPeriodFacetRow {
  total_sales: number;
  invoice_count: number;
}

export async function getDashboardSummary({ from, to }: DashboardRangeParams): Promise<DashboardSummary> {
  const rangeDays = daysBetween(from, to);
  const currentFrom = businessDayStart(from);
  const currentTo = businessDayEnd(to);
  // Previous period = the same number of days immediately before `from`,
  // so a 7-day selection compares against the 7 days before it, not a
  // hardcoded "yesterday."
  const previousTo = new Date(currentFrom.getTime() - 1);
  const previousFrom = new Date(currentFrom.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  const [facetResult, pendingResult, stockResult, newCustomers] = await Promise.all([
    InvoiceModel.aggregate<{
      current: CurrentPeriodFacetRow[];
      previous: PreviousPeriodFacetRow[];
    }>([
      {
        $facet: {
          current: [
            { $match: { createdAt: { $gte: currentFrom, $lte: currentTo } } },
            {
              $group: {
                _id: null,
                total_sales: { $sum: "$grandTotal" },
                invoice_count: { $sum: 1 },
                // Inner $sum is the array-reduce operator (sums items[].pieces
                // per invoice); outer $sum is the $group accumulator (sums
                // that across every matched invoice). Two different $sum's.
                items_sold: { $sum: { $sum: "$items.pieces" } },
                net_weight_sold_g: { $sum: { $sum: "$items.netWtG" } },
              },
            },
          ],
          previous: [
            { $match: { createdAt: { $gte: previousFrom, $lte: previousTo } } },
            {
              $group: {
                _id: null,
                total_sales: { $sum: "$grandTotal" },
                invoice_count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),
    InvoiceModel.aggregate<{ pending_amount: number }>([
      { $match: { paymentStatus: { $ne: "paid" } } },
      { $group: { _id: null, pending_amount: { $sum: "$pendingAmount" } } },
    ]),
    TagModel.aggregate<{ count: number; net_weight_g: number }>([
      { $match: { status: "tagged" } },
      { $group: { _id: null, count: { $sum: 1 }, net_weight_g: { $sum: "$netWtG" } } },
    ]),
    CustomerModel.countDocuments({ createdAt: { $gte: currentFrom, $lte: currentTo } }),
  ]);
  const current = facetResult[0]?.current[0] ?? {
    total_sales: 0,
    invoice_count: 0,
    items_sold: 0,
    net_weight_sold_g: 0,
  };
  const previous = facetResult[0]?.previous[0] ?? { total_sales: 0, invoice_count: 0 };
  const pendingAmount = pendingResult[0]?.pending_amount ?? 0;
  const stock = stockResult[0] ?? { count: 0, net_weight_g: 0 };

  return {
    from,
    to,
    total_sales: current.total_sales,
    invoice_count: current.invoice_count,
    items_sold: current.items_sold,
    net_weight_sold_g: roundTo(current.net_weight_sold_g, 3),
    avg_invoice_value: current.invoice_count > 0 ? roundTo(current.total_sales / current.invoice_count, 2) : 0,
    new_customers: newCustomers,
    vs_previous_period: {
      total_sales_pct: percentChange(current.total_sales, previous.total_sales),
      invoice_count_pct: percentChange(current.invoice_count, previous.invoice_count),
    },
    pending_amount: pendingAmount,
    stock_on_hand: {
      count: stock.count,
      net_weight_g: roundTo(stock.net_weight_g, 3),
    },
  };
}

export async function getSalesTrend({ from, to }: DashboardRangeParams): Promise<SalesTrendPoint[]> {
  const matchFrom = businessDayStart(from);
  const matchTo = businessDayEnd(to);

  const results = await InvoiceModel.aggregate<{ _id: string; total_sales: number }>([
    { $match: { createdAt: { $gte: matchFrom, $lte: matchTo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
        total_sales: { $sum: "$grandTotal" },
      },
    },
  ]);

  const byDate = new Map(results.map((row) => [row._id, row.total_sales]));

  // Calendar-date enumeration only, deliberately independent of the IST
  // offset above - `from`/`to` are already the calendar dates we want to
  // list, so a plain UTC-midnight counter is enough to walk from one to the
  // other day by day.
  const points: SalesTrendPoint[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const calendarEnd = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= calendarEnd) {
    const dateKey = cursor.toISOString().slice(0, 10);
    points.push({ date: dateKey, total_sales: byDate.get(dateKey) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}
