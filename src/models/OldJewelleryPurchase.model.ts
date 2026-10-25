import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { PaymentMode } from "@/models/Invoice.model";

export type OldJewelleryPurchaseSource = "billing_exchange" | "standalone";
export type ExcessSettlement = "refund" | "credit";
export type OldJewelleryPurchaseStatus = "active" | "cancelled";

export interface OldJewelleryRefund {
  amount: number;
  mode: PaymentMode;
  reference?: string | null;
  remarks?: string | null;
  confirmedAt: Date;
}

export interface OldJewelleryPurchaseDocument extends Document {
  purchaseNo: string;
  customerId: Types.ObjectId;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  // Phase 1 only ever writes "billing_exchange" - "standalone" is reserved
  // for the deferred Old Jewellery Purchase page (sell-without-buy).
  source: OldJewelleryPurchaseSource;
  linkedInvoiceId: Types.ObjectId | null;
  totalPurchaseValue: number;
  // = the linked invoice's exchangeApplied, denormalized here so the
  // purchase receipt doesn't need a second lookup against the invoice.
  appliedToInvoice: number;
  excessAmount: number;
  // Phase 1 only ever writes "refund" or null - "credit" is reserved for
  // the deferred Customer Credit phase.
  excessSettlement: ExcessSettlement | null;
  refund: OldJewelleryRefund | null;
  // Reserved now even though the cancel-and-recreate workflow itself is
  // deferred, so that feature doesn't need a schema migration later - see
  // docs/old-jewellery-exchange-plan.md's "Key decisions" §2 (Phase 1
  // technical plan).
  status: OldJewelleryPurchaseStatus;
  // Nullable - no route in this app currently threads the authenticated
  // admin's user id through to a service-layer write (requireAuth()
  // verifies the token and discards the payload; every other write here
  // has the same "no admin attribution" posture). Capturing it properly
  // would mean changing requireAuth()'s contract across every route, well
  // beyond this feature's scope - left null until that's done separately.
  createdBy: Types.ObjectId | null;
  // Idempotency key for the standalone purchase path only (sell-without-buy,
  // see docs/old-jewellery-exchange-plan.md) - a double-click/network-retry
  // of "Record Purchase" returns the original purchase instead of creating
  // a second one and paying the customer out twice. The billing_exchange
  // path never writes this (it's already covered by Invoice.operationId,
  // whose check gates the whole transaction including this document's
  // creation) - genuinely absent (not set to null) for every billing_exchange
  // row. No schema `default` here on purpose: a sparse unique index only
  // excludes documents where the field is truly MISSING, not documents
  // where it's present with value null - a schema default of null made
  // every billing_exchange purchase "present" in the index with the same
  // value, so the second one ever created collided with a duplicate-key
  // error (the bug this comment is here to prevent reintroducing).
  operationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<OldJewelleryRefund>(
  {
    amount: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: ["cash", "upi", "card", "bank_transfer"], required: true },
    reference: { type: String, default: null, trim: true },
    remarks: { type: String, default: null, trim: true },
    confirmedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const oldJewelleryPurchaseSchema = new Schema<OldJewelleryPurchaseDocument>(
  {
    purchaseNo: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: String,
      address: String,
    },
    source: { type: String, enum: ["billing_exchange", "standalone"], required: true },
    linkedInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },
    totalPurchaseValue: { type: Number, required: true, min: 0 },
    appliedToInvoice: { type: Number, required: true, min: 0, default: 0 },
    excessAmount: { type: Number, required: true, min: 0, default: 0 },
    excessSettlement: { type: String, enum: ["refund", "credit"], default: null },
    refund: { type: refundSchema, default: null },
    status: { type: String, enum: ["active", "cancelled"], required: true, default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // No `default: null` - see the interface field's comment above for why.
    operationId: { type: String },
  },
  { timestamps: true },
);

oldJewelleryPurchaseSchema.index({ createdAt: -1 });
oldJewelleryPurchaseSchema.index({ operationId: 1 }, { unique: true, sparse: true });

export const OldJewelleryPurchaseModel: Model<OldJewelleryPurchaseDocument> =
  (models.OldJewelleryPurchase as Model<OldJewelleryPurchaseDocument>) ??
  model<OldJewelleryPurchaseDocument>("OldJewelleryPurchase", oldJewelleryPurchaseSchema);
