import { Schema, model, models, Types, type Document, type Model } from "mongoose";

export type PaymentStatus = "unpaid" | "partial" | "paid";
export type PaymentMode = "cash" | "upi" | "card" | "bank_transfer";

export interface InvoiceItem {
  srNo: number;
  tagCode?: string | null;
  description: string;
  hsnCode: string;
  metal: string;
  purity: string;
  pieces: number;
  grossWtG: number;
  stoneWtG: number;
  netWtG: number;
  ratePerGram: number;
  makingCharge: number;
  stoneCharge: number;
  total: number;
}

export interface InvoicePayment {
  amount: number;
  mode: PaymentMode;
  paidAt: Date;
}

export interface InvoiceDocument extends Document {
  invoiceNo: string;
  customerId: Types.ObjectId;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  items: InvoiceItem[];
  payments: InvoicePayment[];
  subtotal: number;
  discountAmount: number;
  gstPercent: number;
  gstAmount: number;
  grandTotal: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

// tagCode intentionally does not resolve as a real populate ref - Tag is keyed
// by its ObjectId _id, not by `code`. Looking up the tags for an invoice is
// always done directly (TagModel.find({ code: { $in: tagCodes } })), never
// via .populate("items.tagCode"). Kept as a plain string for that reason.
const invoiceItemSchema = new Schema<InvoiceItem>(
  {
    srNo: { type: Number, required: true },
    tagCode: { type: String, default: null },
    description: { type: String, required: true },
    hsnCode: { type: String, required: true },
    metal: { type: String, required: true },
    // Not required - purity is optional end-to-end (explicit product
    // decision, see invoice.schema.ts). Defaults to "" rather than being
    // left undefined, matching what the client always sends.
    purity: { type: String, default: "" },
    pieces: { type: Number, required: true, default: 1 },
    grossWtG: { type: Number, required: true, min: 0 },
    stoneWtG: { type: Number, required: true, min: 0, default: 0 },
    netWtG: { type: Number, required: true, min: 0 },
    ratePerGram: { type: Number, required: true, min: 0 },
    makingCharge: { type: Number, required: true, min: 0, default: 0 },
    stoneCharge: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const invoicePaymentSchema = new Schema<InvoicePayment>(
  {
    amount: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: ["cash", "upi", "card", "bank_transfer"], required: true },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const invoiceSchema = new Schema<InvoiceDocument>(
  {
    invoiceNo: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: String,
      address: String,
    },
    items: { type: [invoiceItemSchema], required: true },
    payments: { type: [invoicePaymentSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    gstPercent: { type: Number, required: true, min: 0, default: 3 },
    gstAmount: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    pendingAmount: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
      index: true,
    },
  },
  { timestamps: true },
);

invoiceSchema.index({ createdAt: -1 });

export const InvoiceModel: Model<InvoiceDocument> =
  (models.Invoice as Model<InvoiceDocument>) ?? model<InvoiceDocument>("Invoice", invoiceSchema);
