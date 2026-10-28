import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { MetalPurityDocument } from "@/models/MetalPurity.model";

export type TagStatus = "tagged" | "sold";
// "not_set" is a real, stored state (see tag.schema.ts) - distinguishes a
// tag that never had its Stone Amount dialog applied from one explicitly
// set to "fixed" ₹0.
export type StoneAmountMethod = "not_set" | "fixed" | "per_gram";

export interface TagDocument extends Document {
  code: string;
  productName: string;
  purityId: Types.ObjectId | MetalPurityDocument;
  grossWtG: number;
  stoneWtG: number;
  netWtG: number;
  status: TagStatus;
  // Free text, optional, never read by any calculation - a reference code
  // to remember which buyer this item was lent/sold against. Same
  // "optional end-to-end, default empty string" shape as Invoice.model.ts's
  // own buyerCode.
  buyerCode: string;
  // stoneAmount is the stored, authoritative ₹ result - never recomputed
  // from method/value elsewhere, same convention Invoice.model.ts's items
  // already use for makingCharge. method/value just record what produced
  // it, for later re-edit.
  stoneAmountMethod: StoneAmountMethod;
  totalStoneAmount: number;
  stoneAmount: number;
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
    buyerCode: { type: String, default: "", trim: true },
    stoneAmountMethod: { type: String, enum: ["not_set", "fixed", "per_gram"], default: "not_set" },
    totalStoneAmount: { type: Number, default: 0, min: 0 },
    stoneAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const TagModel: Model<TagDocument> =
  (models.Tag as Model<TagDocument>) ?? model<TagDocument>("Tag", tagSchema);
