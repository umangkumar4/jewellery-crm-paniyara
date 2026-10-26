export type MakingMethod = "fixed" | "per_gram" | "percent_metal";

export interface MakingChargeCalculationInput {
  method: MakingMethod;
  // The raw number the admin typed into the "Making method" dialog - a flat
  // rupee amount for "fixed", a ₹/g rate for "per_gram", or a percentage for
  // "percent_metal". Per-piece, same convention as every other weight/rate
  // field in this module.
  value: number;
  netWtG: number;
  ratePerGram: number;
}

// Mirrors calculateItemTotal's own metalValue rounding exactly, so a
// "percent_metal" making charge is computed against the same number that
// line's total calculation actually uses - never a second, slightly
// different metal value that could quietly drift from it.
export function calculateMakingCharge({ method, value, netWtG, ratePerGram }: MakingChargeCalculationInput): number {
  switch (method) {
    case "per_gram":
      return Math.round(value * netWtG);
    case "percent_metal": {
      const metalValue = Math.round(netWtG * ratePerGram);
      return Math.round((value / 100) * metalValue);
    }
    case "fixed":
    default:
      return Math.round(value);
  }
}

export interface LineItemCalculationInput {
  // netWtG/ratePerGram/makingCharge/stoneCharge are all PER-PIECE figures -
  // explicit product decision: a line with pieces > 1 (e.g. 5 identical
  // bangles) is weighed/priced as one piece, and the line total scales by
  // the piece count. Previously `pieces` wasn't part of this calculation at
  // all, which under-billed any multi-piece line by a factor of `pieces`.
  netWtG: number;
  ratePerGram: number;
  makingCharge: number;
  stoneCharge: number;
  pieces: number;
}

export function calculateItemTotal(item: LineItemCalculationInput): number {
  const metalValue = Math.round(item.netWtG * item.ratePerGram);
  const perPieceTotal = metalValue + Math.round(item.makingCharge) + Math.round(item.stoneCharge);
  return perPieceTotal * item.pieces;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  gstAmount: number;
  gstPercent: number;
  grandTotal: number;
}

// CGST%/SGST% are independently editable by the cashier (not forced to a
// 50/50 split of one GST% - a future inter-state sale may need an uneven
// split), so each is applied to the taxable amount separately rather than
// halving a single combined GST%/GST amount. gstPercent/gstAmount are the
// derived sums - every other consumer of "GST" (dashboard, invoice list,
// the server's grand_total sanity check) reads those, unaffected by this.
export function calculateInvoiceTotals(
  items: { total: number }[],
  discountAmount: number = 0,
  cgstPercent: number = 1.5,
  sgstPercent: number = 1.5,
): InvoiceTotals {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const safeDiscount = Math.min(discountAmount, subtotal);
  const taxableAmount = Math.max(0, subtotal - safeDiscount);
  const cgstAmount = Math.round(((taxableAmount * cgstPercent) / 100) * 100) / 100;
  const sgstAmount = Math.round(((taxableAmount * sgstPercent) / 100) * 100) / 100;
  const gstAmount = Math.round((cgstAmount + sgstAmount) * 100) / 100;
  const gstPercent = Math.round((cgstPercent + sgstPercent) * 100) / 100;
  const grandTotal = Math.round(taxableAmount + gstAmount);

  return {
    subtotal,
    discountAmount: safeDiscount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    gstAmount,
    gstPercent,
    grandTotal,
  };
}

export interface ExchangeSettlement {
  // Sum of old jewellery items' finalValue, rounded to a whole rupee here -
  // finalValue is a free-typed field that can carry decimals (unlike
  // calculatedValue, which is always Math.round()-ed), and every other
  // money figure in this app (grandTotal, pendingAmount) is a whole rupee.
  // Rounding once at this shared boundary stops fractional drift from ever
  // entering the rest of the settlement math.
  oldJewelleryTotal: number;
  // min(oldJewelleryTotal, grandTotal) - what's actually applied to the bill.
  exchangeApplied: number;
  // max(0, oldJewelleryTotal - grandTotal) - old jewellery worth more than
  // the bill. Surfaced here but not settled by this function - the Refund/
  // Credit choice is a later phase (docs/old-jewellery-exchange-plan.md).
  excessAmount: number;
}

// The one shared source of truth for exchange figures - called from every
// place that needs them (TotalsPanel for live display, billing/page.tsx for
// the payment cap and eventual submit body), same "the number shown and the
// number used can never drift apart" principle calculateInvoiceTotals
// already established for subtotal/GST.
export function calculateExchangeApplied(
  oldJewelleryItems: { finalValue: number }[],
  grandTotal: number,
): ExchangeSettlement {
  const oldJewelleryTotal = Math.round(oldJewelleryItems.reduce((sum, item) => sum + item.finalValue, 0));
  const exchangeApplied = Math.min(oldJewelleryTotal, grandTotal);
  const excessAmount = Math.max(0, oldJewelleryTotal - grandTotal);
  return { oldJewelleryTotal, exchangeApplied, excessAmount };
}

export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface NewPending {
  pendingAmount: number;
  paymentStatus: PaymentStatus;
  // Amount still due after exchange/credit but before cash/UPI/etc - what
  // PaymentPanel's "Up to ₹X" cap and "Pay full amount" shortcut should use,
  // exposed here so every caller reads it from one place instead of each
  // re-deriving grandTotal - exchangeApplied slightly differently.
  remainingBeforePayment: number;
}

export function calculateNewPending(
  grandTotal: number,
  exchangeApplied: number,
  // Always 0 in Phase 1 - reserved for the deferred Credit phase. No default
  // value, deliberately - every caller must state it explicitly rather than
  // silently inherit a hidden 0, so a future caller can't forget it exists.
  creditUsed: number,
  paidAmount: number,
): NewPending {
  // Defensively clamped, same "never trust a raw input blindly even
  // internally" rule calculateInvoiceTotals already applies to discountAmount.
  const safeExchange = Math.min(Math.max(0, exchangeApplied), grandTotal);
  const safeCredit = Math.min(Math.max(0, creditUsed), grandTotal - safeExchange);
  const remainingBeforePayment = Math.max(0, grandTotal - safeExchange - safeCredit);
  const pendingAmount = Math.max(0, remainingBeforePayment - paidAmount);
  const settled = safeExchange + safeCredit + paidAmount;

  let paymentStatus: PaymentStatus = "unpaid";
  if (settled >= grandTotal) {
    paymentStatus = "paid";
  } else if (settled > 0) {
    paymentStatus = "partial";
  }

  return { pendingAmount, paymentStatus, remainingBeforePayment };
}

export interface OldJewelleryItemValuationInput {
  grossWtG: number;
  stoneWtG: number;
  dustWtG: number;
  otherDeductionWtG: number;
  ratePerGram: number;
}

export interface OldJewelleryItemValuation {
  netWtG: number;
  calculatedValue: number;
}

// Decision 15: net weight is auto-derived only, never directly editable -
// same "overwrites on every deduction change" convention the existing
// new-jewellery billing form already uses for gross - stone. Rounded to
// 3dp, not 2, for the same milligram-precision reason documented on that
// form (ItemTable.tsx's ManualAddForm).
export function calculateOldJewelleryItemValuation({
  grossWtG,
  stoneWtG,
  dustWtG,
  otherDeductionWtG,
  ratePerGram,
}: OldJewelleryItemValuationInput): OldJewelleryItemValuation {
  const netWtG = Math.round(Math.max(0, grossWtG - stoneWtG - dustWtG - otherDeductionWtG) * 1000) / 1000;
  const calculatedValue = Math.round(netWtG * ratePerGram);
  return { netWtG, calculatedValue };
}

// Single source of truth for "has this old-jewellery item's value been
// overridden" - a final value counts as overridden whenever it differs from
// the formula-calculated one. Deliberately NOT a stored field: it's fully
// derivable from finalValue/calculatedValue, which are both already the
// real source of truth, so this stays a cheap live check reused by every
// caller instead of a third field that could drift out of sync with them.
export function isValueOverridden(finalValue: number, calculatedValue: number): boolean {
  return finalValue !== calculatedValue;
}
