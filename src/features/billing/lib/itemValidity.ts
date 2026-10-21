import type { BillingItem } from "@/store/useBillingStore";

/**
 * The same mandatory rule createInvoiceSchema enforces for description,
 * gross/net weight, and rate per gram (src/schemas/invoice.schema.ts) -
 * duplicated here deliberately as a cheap, synchronous check so the grid
 * can show a row as invalid immediately as it's typed, and so "Finalize
 * Sale" can be disabled proactively, rather than only ever discovering a
 * problem after an explicit submit attempt triggers the full Zod parse.
 * purity/hsn_code are intentionally NOT included - already required
 * server-side, but left ungated here per an explicit product decision.
 */
export function isItemValid(item: BillingItem): boolean {
  return (
    item.description.trim().length > 0 &&
    item.grossWtG > 0 &&
    item.netWtG > 0 &&
    item.ratePerGram > 0
  );
}
