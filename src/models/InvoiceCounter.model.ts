import { Schema, model, models, type Model } from "mongoose";

export interface InvoiceCounterDocument {
  _id: number;
  lastNumber: number;
}

const invoiceCounterSchema = new Schema<InvoiceCounterDocument>({
  _id: { type: Number, required: true },
  lastNumber: { type: Number, required: true, default: 0 },
});

export const InvoiceCounterModel: Model<InvoiceCounterDocument> =
  (models.InvoiceCounter as Model<InvoiceCounterDocument>) ??
  model<InvoiceCounterDocument>("InvoiceCounter", invoiceCounterSchema);
