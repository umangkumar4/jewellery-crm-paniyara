import { Schema, model, models, type Document, type Model } from "mongoose";

export interface MetalPurityDocument extends Document {
  metal: string;
  purity: string;
  ratePerGram: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const metalPuritySchema = new Schema<MetalPurityDocument>(
  {
    metal: { type: String, required: true, trim: true },
    purity: { type: String, required: true, trim: true },
    ratePerGram: { type: Number, min: 0, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

metalPuritySchema.index({ metal: 1, purity: 1 }, { unique: true });

export const MetalPurityModel: Model<MetalPurityDocument> =
  (models.MetalPurity as Model<MetalPurityDocument>) ??
  model<MetalPurityDocument>("MetalPurity", metalPuritySchema);
