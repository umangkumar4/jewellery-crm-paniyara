import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { OldJewelleryPurchaseDocument } from "@/models/OldJewelleryPurchase.model";

export type OldJewelleryItemStatus = "IN_SHOP" | "DISPOSED" | "MELTED";

export interface OldJewelleryStatusChange {
  from: OldJewelleryItemStatus;
  to: OldJewelleryItemStatus;
  reason: string;
  // Nullable - same gap as OldJewelleryPurchase.createdBy (Step 5): no
  // route in this app threads the authenticated admin's user id through to
  // a service-layer write, so this can never actually be populated today.
  changedBy: Types.ObjectId | null;
  changedAt: Date;
}

// Its own top-level collection, not embedded in OldJewelleryPurchase -
// every purchased item needs an independent stock identity and status
// transition (IN_SHOP -> DISPOSED/MELTED) per-item, even though several
// items share one purchase reference/receipt.
export interface OldJewelleryItemDocument extends Document {
  // Union with the populated document, same convention as Tag.model.ts's
  // purityId - plain ObjectId by default, the real document only after an
  // explicit .populate("purchaseId", ...) call, checked at the call site.
  purchaseId: Types.ObjectId | OldJewelleryPurchaseDocument;
  srNo: number;
  description: string;
  metal: string;
  purity: string;
  grossWtG: number;
  stoneWtG: number;
  dustWtG: number;
  otherDeductionWtG: number;
  // Auto-derived only (Decision 15): max(0, gross - stone - dust - other),
  // rounded 3dp - never directly editable, same convention as the existing
  // new-jewellery billing form's net weight field.
  netWtG: number;
  // Snapshot of MetalPurity.purchaseRatePerGram at entry time - null if that
  // purity had no default purchase rate configured yet, in which case the
  // admin had to type appliedRatePerGram manually.
  defaultRatePerGram: number | null;
  appliedRatePerGram: number;
  calculatedValue: number;
  // Defaults to calculatedValue, admin-overridable - overrideReason is
  // optional free text (this app is admin-only, no approval chain), stored
  // whenever finalValue diverges from calculatedValue.
  finalValue: number;
  overrideReason: string;
  status: OldJewelleryItemStatus;
  statusHistory: OldJewelleryStatusChange[];
  createdAt: Date;
  updatedAt: Date;
}

const statusChangeSchema = new Schema<OldJewelleryStatusChange>(
  {
    from: { type: String, enum: ["IN_SHOP", "DISPOSED", "MELTED"], required: true },
    to: { type: String, enum: ["IN_SHOP", "DISPOSED", "MELTED"], required: true },
    reason: { type: String, required: true, trim: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    changedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const oldJewelleryItemSchema = new Schema<OldJewelleryItemDocument>(
  {
    purchaseId: { type: Schema.Types.ObjectId, ref: "OldJewelleryPurchase", required: true, index: true },
    srNo: { type: Number, required: true },
    description: { type: String, required: true, trim: true },
    metal: { type: String, required: true, trim: true },
    purity: { type: String, required: true, trim: true },
    grossWtG: { type: Number, required: true, min: 0 },
    stoneWtG: { type: Number, required: true, min: 0, default: 0 },
    dustWtG: { type: Number, required: true, min: 0, default: 0 },
    otherDeductionWtG: { type: Number, required: true, min: 0, default: 0 },
    netWtG: { type: Number, required: true, min: 0 },
    defaultRatePerGram: { type: Number, min: 0, default: null },
    appliedRatePerGram: { type: Number, required: true, min: 0 },
    calculatedValue: { type: Number, required: true, min: 0 },
    finalValue: { type: Number, required: true, min: 0 },
    overrideReason: { type: String, default: "", trim: true },
    status: { type: String, enum: ["IN_SHOP", "DISPOSED", "MELTED"], required: true, default: "IN_SHOP", index: true },
    statusHistory: { type: [statusChangeSchema], default: [] },
  },
  { timestamps: true },
);

export const OldJewelleryItemModel: Model<OldJewelleryItemDocument> =
  (models.OldJewelleryItem as Model<OldJewelleryItemDocument>) ??
  model<OldJewelleryItemDocument>("OldJewelleryItem", oldJewelleryItemSchema);
