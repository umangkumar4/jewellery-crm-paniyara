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
  gstAmount: number;
  grandTotal: number;
}

export function calculateInvoiceTotals(
  items: { total: number }[],
  discountAmount: number = 0,
  gstPercent: number = 3.0,
): InvoiceTotals {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const safeDiscount = Math.min(discountAmount, subtotal);
  const taxableAmount = Math.max(0, subtotal - safeDiscount);
  const gstAmount = Math.round(((taxableAmount * gstPercent) / 100) * 100) / 100;
  const grandTotal = Math.round(taxableAmount + gstAmount);

  return { subtotal, discountAmount: safeDiscount, taxableAmount, gstAmount, grandTotal };
}

export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface NewPending {
  pendingAmount: number;
  paymentStatus: PaymentStatus;
}

export function calculateNewPending(grandTotal: number, paidAmount: number): NewPending {
  const pendingAmount = Math.max(0, grandTotal - paidAmount);
  let paymentStatus: PaymentStatus = "unpaid";

  if (paidAmount >= grandTotal) {
    paymentStatus = "paid";
  } else if (paidAmount > 0) {
    paymentStatus = "partial";
  }

  return { pendingAmount, paymentStatus };
}
