import { Schema, model, models, type Document, type Model } from "mongoose";

export interface MetalPurityDocument extends Document {
  metal: string;
  purity: string;
  ratePerGram: number | null;
  // What the shop pays per gram when buying this metal/purity back as old
  // jewellery - independent of ratePerGram (what it charges selling new
  // jewellery). Deliberately a second field on the same catalog row rather
  // than a separate collection: one purity list, two independent rate
  // numbers, so updating one never touches the other, but adding a new
  // purity only ever has to happen in one place (see
  // docs/old-jewellery-exchange-plan.md's "Key decisions" §2).
  purchaseRatePerGram: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const metalPuritySchema = new Schema<MetalPurityDocument>(
  {
    metal: { type: String, required: true, trim: true },
    purity: { type: String, required: true, trim: true },
    ratePerGram: { type: Number, min: 0, default: null },
    purchaseRatePerGram: { type: Number, min: 0, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

metalPuritySchema.index({ metal: 1, purity: 1 }, { unique: true });

export const MetalPurityModel: Model<MetalPurityDocument> =
  (models.MetalPurity as Model<MetalPurityDocument>) ??
  model<MetalPurityDocument>("MetalPurity", metalPuritySchema);
