import type { BillingItem, OldJewelleryDraftItem } from "@/store/useBillingStore";

/**
 * The same mandatory rule createInvoiceSchema enforces for description,
 * gross/net weight, and rate per gram (src/schemas/invoice.schema.ts) -
 * duplicated here deliberately as a cheap, synchronous check so the grid
 * can show a row as invalid immediately as it's typed, and so "Finalize
 * Sale" can be disabled proactively, rather than only ever discovering a
 * problem after an explicit submit attempt triggers the full Zod parse.
 * purity/hsn_code are intentionally NOT included - already required
 * server-side, but left ungated here per an explicit product decision.
 * pieces IS included - it now multiplies directly into the line total
 * (calculations.ts), so an unset/fractional pieces value is a real pricing
 * error, not just a missing count.
 */
export function isItemValid(item: BillingItem): boolean {
  return (
    item.description.trim().length > 0 &&
    item.grossWtG > 0 &&
    item.netWtG > 0 &&
    item.ratePerGram > 0 &&
    item.pieces > 0 &&
    Number.isInteger(item.pieces)
  );
}

/**
 * Same role as isItemValid above, for old jewellery exchange rows - mirrors
 * oldJewelleryItemInputSchema's mandatory fields (invoice.schema.ts):
 * description, gross weight, and rate must be real positive values. Net
 * weight isn't separately checked - it's auto-derived (Decision 15), so a
 * legitimately all-deducted item could be 0, same reasoning stone_wt_g
 * stays unchecked for new-jewellery items.
 */
export function isOldJewelleryItemValid(item: OldJewelleryDraftItem): boolean {
  return item.description.trim().length > 0 && item.grossWtG > 0 && item.appliedRatePerGram > 0;
}
