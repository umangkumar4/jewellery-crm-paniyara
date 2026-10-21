import mongoose, { Types, type ClientSession, type QueryFilter } from "mongoose";
import { InvoiceModel, type InvoiceDocument } from "@/models/Invoice.model";
import { InvoiceCounterModel } from "@/models/InvoiceCounter.model";
import { TagModel } from "@/models/Tag.model";
import { CustomerModel } from "@/models/Customer.model";
import type { CreateInvoiceInput, AddInvoicePaymentInput } from "@/schemas/invoice.schema";

export class TagNotFoundError extends Error {
  constructor(public readonly codes: string[]) {
    super(`No tag found for code(s): ${codes.join(", ")}`);
    this.name = "TagNotFoundError";
  }
}

export class TagAlreadySoldError extends Error {
  constructor(public readonly codes: string[]) {
    super(`Tag(s) already sold: ${codes.join(", ")}`);
    this.name = "TagAlreadySoldError";
  }
}

export class InvoiceNotFoundError extends Error {
  constructor() {
    super("No invoice with this id");
    this.name = "InvoiceNotFoundError";
  }
}

export class PaymentExceedsBalanceError extends Error {
  constructor() {
    super("Paid amount cannot exceed the invoice's grand total");
    this.name = "PaymentExceedsBalanceError";
  }
}

async function getNextInvoiceNumber(year: number, session: ClientSession): Promise<string> {
  const counter = await InvoiceCounterModel.findByIdAndUpdate(
    year,
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true, session },
  );
  const sequence = String(counter.lastNumber).padStart(4, "0");
  return `INV-${year}-${sequence}`;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDocument> {
  const session = await mongoose.startSession();
  let createdInvoice: InvoiceDocument | undefined;

  try {
    // withTransaction() (not manual startTransaction/commitTransaction) -
    // reproduced live while building this: the very first write to a
    // collection that doesn't exist yet can fail with a transient
    // "catalog changes" WriteConflict inside a transaction. The driver
    // labels that TransientTransactionError, and withTransaction() retries
    // the whole callback automatically on that label (not on our own
    // TagNotFoundError/TagAlreadySoldError, which have no such label and
    // propagate immediately) - the officially recommended pattern instead
    // of hand-rolling retry logic.
    await session.withTransaction(async () => {
      // Reads that gate a write (tag status) have to happen inside the same
      // session, not before the transaction opens - otherwise a second
      // concurrent sale could grab the same tag in the gap between our check
      // and our write. Reading inside the session gives snapshot isolation.
      const tagCodes = Array.from(
        new Set(input.items.map((item) => item.tag_code).filter((code): code is string => !!code)),
      );

      if (tagCodes.length > 0) {
        const tags = await TagModel.find({ code: { $in: tagCodes } }).session(session);

        const foundCodes = new Set(tags.map((tag) => tag.code));
        const missingCodes = tagCodes.filter((code) => !foundCodes.has(code));
        if (missingCodes.length > 0) {
          throw new TagNotFoundError(missingCodes);
        }

        const soldCodes = tags.filter((tag) => tag.status === "sold").map((tag) => tag.code);
        if (soldCodes.length > 0) {
          throw new TagAlreadySoldError(soldCodes);
        }

        await TagModel.updateMany({ code: { $in: tagCodes } }, { $set: { status: "sold" } }, { session });
      }

      const year = new Date().getFullYear();
      const invoiceNo = await getNextInvoiceNumber(year, session);

      // Overwrite-every-time, per docs/billing-plan.md decision 3 - but only
      // for fields actually present in this sale's customer object. $set
      // silently skips undefined values (the Mongo driver drops them before
      // sending the command), so omitting email/address here leaves whatever
      // was already stored untouched rather than blanking it out.
      // upsert: true + new: true always returns a document, never null -
      // the non-null assertion reflects that guarantee, not an assumption.
      const customer = (await CustomerModel.findOneAndUpdate(
        { phone: input.customer.phone },
        {
          $set: {
            name: input.customer.name,
            email: input.customer.email,
            address: input.customer.address,
          },
        },
        { upsert: true, new: true, session },
      ))!;

      const payments = input.payment
        ? [{ amount: input.payment.amount, mode: input.payment.mode, paidAt: new Date() }]
        : [];

      const [invoice] = await InvoiceModel.create(
        [
          {
            invoiceNo,
            customerId: customer._id,
            customer: {
              name: input.customer.name,
              phone: input.customer.phone,
              email: input.customer.email,
              address: input.customer.address,
            },
            items: input.items.map((item, index) => ({
              srNo: index + 1,
              tagCode: item.tag_code ?? null,
              description: item.description,
              hsnCode: item.hsn_code,
              metal: item.metal,
              purity: item.purity,
              pieces: item.pieces,
              grossWtG: item.gross_wt_g,
              stoneWtG: item.stone_wt_g,
              netWtG: item.net_wt_g,
              ratePerGram: item.rate_per_gram,
              makingCharge: item.making_charge,
              stoneCharge: item.stone_charge,
              total: item.total,
            })),
            payments,
            subtotal: input.subtotal,
            discountAmount: input.discount_amount,
            gstPercent: input.gst_percent,
            gstAmount: input.gst_amount,
            grandTotal: input.grand_total,
            paidAmount: input.paid_amount,
            pendingAmount: input.pending_amount,
            paymentStatus: input.payment_status,
          },
        ],
        { session },
      );

      createdInvoice = invoice;
    });

    return createdInvoice!;
  } finally {
    session.endSession();
  }
}

export interface ListInvoicesParams {
  page: number;
  limit: number;
  date?: string;
  customerId?: string;
}

export async function listInvoices({ page, limit, date, customerId }: ListInvoicesParams) {
  const filter: QueryFilter<InvoiceDocument> = {};
  if (date) {
    // NOTE: day boundaries are UTC, not IST. A sale made late at night IST
    // can land in the UTC-previous day's bucket. Fine for a single-shop
    // deployment on a server whose clock nobody has reasoned about yet;
    // revisit if this ever needs to be exact (pin a server TZ or use an
    // explicit +05:30 offset here).
    filter.createdAt = {
      $gte: new Date(`${date}T00:00:00.000Z`),
      $lte: new Date(`${date}T23:59:59.999Z`),
    };
  }
  // Same leniency as `date` above: a malformed id is silently ignored
  // (falls back to the unfiltered list) rather than a 500 - this route
  // doesn't validate its GET query params with Zod at all, so this
  // doesn't introduce a new validation style for just one param.
  if (customerId && Types.ObjectId.isValid(customerId)) {
    filter.customerId = new Types.ObjectId(customerId);
  }

  const [items, total] = await Promise.all([
    InvoiceModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    InvoiceModel.countDocuments(filter),
  ]);

  return { items, total };
}

// Mongoose's findById throws a CastError on a malformed ObjectId string
// instead of returning null - guarding here lets every caller return a
// clean 404 instead of leaking a 500 for "someone typo'd the URL".
export async function findInvoiceById(id: string): Promise<InvoiceDocument | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  return InvoiceModel.findById(id);
}

export async function deleteInvoiceCascade(
  id: string,
): Promise<{ invoiceNo: string; revertedTags: string[] }> {
  if (!Types.ObjectId.isValid(id)) {
    throw new InvoiceNotFoundError();
  }

  const session = await mongoose.startSession();
  let result: { invoiceNo: string; revertedTags: string[] } | undefined;

  try {
    await session.withTransaction(async () => {
      const invoice = await InvoiceModel.findById(id).session(session);
      if (!invoice) {
        throw new InvoiceNotFoundError();
      }

      const tagCodes = invoice.items
        .map((item) => item.tagCode)
        .filter((code): code is string => !!code);

      if (tagCodes.length > 0) {
        await TagModel.updateMany({ code: { $in: tagCodes } }, { $set: { status: "tagged" } }, { session });
      }

      await InvoiceModel.deleteOne({ _id: invoice._id }, { session });

      result = { invoiceNo: invoice.invoiceNo, revertedTags: tagCodes };
    });

    return result!;
  } finally {
    session.endSession();
  }
}

// paid_amount can't be cross-checked against grandTotal in the Zod schema -
// that total lives on the invoice already in the database, not in this
// request body. Checked here, once the invoice is loaded.
export async function addPayment(
  id: string,
  input: AddInvoicePaymentInput,
): Promise<InvoiceDocument> {
  if (!Types.ObjectId.isValid(id)) {
    throw new InvoiceNotFoundError();
  }

  const invoice = await InvoiceModel.findById(id);
  if (!invoice) {
    throw new InvoiceNotFoundError();
  }

  if (input.paid_amount > invoice.grandTotal) {
    throw new PaymentExceedsBalanceError();
  }

  invoice.payments.push({ amount: input.amount, mode: input.mode, paidAt: new Date() });
  invoice.paidAmount = input.paid_amount;
  invoice.pendingAmount = input.pending_amount;
  invoice.paymentStatus = input.payment_status;

  await invoice.save();
  return invoice;
}

export function serializeInvoiceListItem(invoice: InvoiceDocument) {
  return {
    id: invoice._id.toString(),
    invoice_no: invoice.invoiceNo,
    customer_name: invoice.customer.name,
    phone: invoice.customer.phone,
    items_count: invoice.items.length,
    grand_total: invoice.grandTotal,
    paid_amount: invoice.paidAmount,
    pending_amount: invoice.pendingAmount,
    payment_status: invoice.paymentStatus,
    created_at: invoice.createdAt.toISOString(),
  };
}

export function serializeInvoice(invoice: InvoiceDocument) {
  return {
    id: invoice._id.toString(),
    invoice_no: invoice.invoiceNo,
    customer_id: invoice.customerId.toString(),
    customer: {
      name: invoice.customer.name,
      phone: invoice.customer.phone,
      email: invoice.customer.email,
      address: invoice.customer.address,
    },
    items: invoice.items.map((item) => ({
      sr_no: item.srNo,
      tag_code: item.tagCode ?? null,
      description: item.description,
      hsn_code: item.hsnCode,
      metal: item.metal,
      purity: item.purity,
      pieces: item.pieces,
      gross_wt_g: item.grossWtG,
      stone_wt_g: item.stoneWtG,
      net_wt_g: item.netWtG,
      rate_per_gram: item.ratePerGram,
      making_charge: item.makingCharge,
      stone_charge: item.stoneCharge,
      total: item.total,
    })),
    payments: invoice.payments.map((payment) => ({
      amount: payment.amount,
      mode: payment.mode,
      paid_at: payment.paidAt.toISOString(),
    })),
    subtotal: invoice.subtotal,
    discount_amount: invoice.discountAmount,
    gst_percent: invoice.gstPercent,
    gst_amount: invoice.gstAmount,
    grand_total: invoice.grandTotal,
    paid_amount: invoice.paidAmount,
    pending_amount: invoice.pendingAmount,
    payment_status: invoice.paymentStatus,
    created_at: invoice.createdAt.toISOString(),
  };
}
