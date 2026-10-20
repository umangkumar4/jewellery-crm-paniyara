import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { MetalPurityDocument } from "@/models/MetalPurity.model";

export type TagStatus = "tagged" | "sold";

export interface TagDocument extends Document {
  code: string;
  productName: string;
  purityId: Types.ObjectId | MetalPurityDocument;
  grossWtG: number;
  stoneWtG: number;
  netWtG: number;
  status: TagStatus;
  createdAt: Date;
  updatedAt: Date;
}

const tagSchema = new Schema<TagDocument>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    productName: { type: String, required: true, trim: true },
    purityId: { type: Schema.Types.ObjectId, ref: "MetalPurity", required: true },
    grossWtG: { type: Number, required: true, min: 0 },
    stoneWtG: { type: Number, required: true, min: 0, default: 0 },
    netWtG: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["tagged", "sold"], default: "tagged", index: true },
  },
  { timestamps: true },
);

export const TagModel: Model<TagDocument> =
  (models.Tag as Model<TagDocument>) ?? model<TagDocument>("Tag", tagSchema);
