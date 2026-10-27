import { InvoiceModel } from "@/models/Invoice.model";
import { CustomerModel } from "@/models/Customer.model";
import { TagModel } from "@/models/Tag.model";
import { OldJewelleryPurchaseModel } from "@/models/OldJewelleryPurchase.model";
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
  new_customers: number;
  old_jewellery_purchase_count: number;
  old_jewellery_purchased_value: number;
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

interface CurrentPeriodFacetRow {
  total_sales: number;
  invoice_count: number;
  items_sold: number;
}

export async function getDashboardSummary({ from, to }: DashboardRangeParams): Promise<DashboardSummary> {
  const currentFrom = businessDayStart(from);
  const currentTo = businessDayEnd(to);

  const [facetResult, pendingResult, stockResult, newCustomers, oldPurchaseResult] = await Promise.all([
    InvoiceModel.aggregate<CurrentPeriodFacetRow>([
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
    // isDeleted: { $ne: true }, not { isDeleted: false } - a plain equality
    // match does NOT match documents where the field is simply absent
    // (unlike MongoDB's special-cased null queries), and every purchase
    // created before this field existed has no isDeleted field stored at
    // all. $ne: true correctly includes both false and missing, so no
    // existing purchase silently drops out of this KPI.
    // No `source` filter - combines billing_exchange + standalone purchases.
    OldJewelleryPurchaseModel.aggregate<{ count: number; total_value: number }>([
      { $match: { isDeleted: { $ne: true }, createdAt: { $gte: currentFrom, $lte: currentTo } } },
      { $group: { _id: null, count: { $sum: 1 }, total_value: { $sum: "$totalPurchaseValue" } } },
    ]),
  ]);
  const current = facetResult[0] ?? { total_sales: 0, invoice_count: 0, items_sold: 0 };
  const pendingAmount = pendingResult[0]?.pending_amount ?? 0;
  const stock = stockResult[0] ?? { count: 0, net_weight_g: 0 };
  const oldPurchase = oldPurchaseResult[0] ?? { count: 0, total_value: 0 };

  return {
    from,
    to,
    total_sales: current.total_sales,
    invoice_count: current.invoice_count,
    items_sold: current.items_sold,
    new_customers: newCustomers,
    old_jewellery_purchase_count: oldPurchase.count,
    old_jewellery_purchased_value: oldPurchase.total_value,
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
