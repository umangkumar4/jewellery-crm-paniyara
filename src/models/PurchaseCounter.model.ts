import { Schema, model, models, type Model } from "mongoose";

// Atomic ticket-dispenser for OldJewelleryPurchase.purchaseNo ("OJP-2026-0001"),
// same shape and same $inc-based atomicity as InvoiceCounterModel.
export interface PurchaseCounterDocument {
  _id: number;
  lastNumber: number;
}

const purchaseCounterSchema = new Schema<PurchaseCounterDocument>({
  _id: { type: Number, required: true },
  lastNumber: { type: Number, required: true, default: 0 },
});

export const PurchaseCounterModel: Model<PurchaseCounterDocument> =
  (models.PurchaseCounter as Model<PurchaseCounterDocument>) ??
  model<PurchaseCounterDocument>("PurchaseCounter", purchaseCounterSchema);
