import { Schema, model, models, type Model } from "mongoose";

// Same atomic $inc pattern as InvoiceCounter.model.ts, but a single running
// sequence rather than one per year - tag codes never restart, because a
// physical tag from any year can still be scanned.
export interface TagCounterDocument {
  _id: string;
  lastNumber: number;
}

const tagCounterSchema = new Schema<TagCounterDocument>({
  _id: { type: String, required: true },
  lastNumber: { type: Number, required: true, default: 0 },
});

export const TagCounterModel: Model<TagCounterDocument> =
  (models.TagCounter as Model<TagCounterDocument>) ??
  model<TagCounterDocument>("TagCounter", tagCounterSchema);
