export interface LineItemCalculationInput {
  netWtG: number;
  ratePerGram: number;
  makingCharge: number;
  stoneCharge: number;
}

export function calculateItemTotal(item: LineItemCalculationInput): number {
  const metalValue = Math.round(item.netWtG * item.ratePerGram);
  return metalValue + Math.round(item.makingCharge) + Math.round(item.stoneCharge);
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
