import mongoose, { Types, type ClientSession, type QueryFilter } from "mongoose";
import { InvoiceModel, type InvoiceDocument } from "@/models/Invoice.model";
import { InvoiceCounterModel } from "@/models/InvoiceCounter.model";
import { PurchaseCounterModel } from "@/models/PurchaseCounter.model";
import { OldJewelleryPurchaseModel } from "@/models/OldJewelleryPurchase.model";
import { OldJewelleryItemModel } from "@/models/OldJewelleryItem.model";
import { TagModel } from "@/models/Tag.model";
import { CustomerModel } from "@/models/Customer.model";
import type { CreateInvoiceInput, AddInvoicePaymentInput } from "@/schemas/invoice.schema";
import { businessDayStart, businessDayEnd } from "@/lib/business-time";
// Reused server-side, not reimplemented - a plain pure-function module (no
// "use client", no browser API), so the server computes old jewellery
// exchange figures with the exact same formula the client previews live,
// guaranteeing they can never disagree. See docs/old-jewellery-exchange-plan.md.
import { calculateExchangeApplied } from "@/features/billing/lib/calculations";
import { serializeOldJewelleryItemLine } from "@/server/services/oldJewelleryPurchasesService";

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
    // "remaining balance", not "grand total" - still accurate when
    // exchangeApplied is 0 (every ordinary invoice), and correct once an
    // exchange has already settled part of the bill.
    super("Paid amount cannot exceed the invoice's remaining balance");
    this.name = "PaymentExceedsBalanceError";
  }
}

export class RefundMismatchError extends Error {
  constructor(
    public readonly expected: number,
    public readonly got: number,
  ) {
    super(`Refund amount (₹${got}) does not match the exchange excess (₹${expected})`);
    this.name = "RefundMismatchError";
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

async function getNextPurchaseNumber(year: number, session: ClientSession): Promise<string> {
  const counter = await PurchaseCounterModel.findByIdAndUpdate(
    year,
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true, session },
  );
  const sequence = String(counter.lastNumber).padStart(4, "0");
  return `OJP-${year}-${sequence}`;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDocument> {
  const session = await mongoose.startSession();
  let createdInvoice: InvoiceDocument | undefined;

  const hasExchange = input.old_jewellery_items.length > 0;

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
      // Idempotency check - exchange path only (see docs/old-jewellery-exchange-plan.md's
      // Step 5 scoping decision; ordinary sales don't send operation_id and
      // this never runs for them). A repeated submission with the same
      // operation_id - a double-click, or a network retry of a request that
      // actually succeeded - returns the original result instead of
      // creating a second invoice/purchase/inventory set.
      if (hasExchange && input.operation_id) {
        const existing = await InvoiceModel.findOne({ operationId: input.operation_id }).session(session);
        if (existing) {
          createdInvoice = existing;
          return;
        }
      }

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

      // Exchange settlement - server-computed from the old jewellery items
      // and the already-validated grand_total, not trusted from the client.
      // The one deliberate exception to "client math is authoritative" in
      // this schema (decision 20: money moving outside the normal payment
      // flow is validated server-side, not just display-checked).
      let exchangeApplied = 0;
      let exchangeExcessAmount = 0;
      if (hasExchange) {
        // calculateExchangeApplied expects {finalValue} (camelCase, the
        // client draft shape) - mapped here rather than changing the
        // function's signature just for this one snake_case caller.
        const settlement = calculateExchangeApplied(
          input.old_jewellery_items.map((item) => ({ finalValue: item.final_value })),
          input.grand_total,
        );
        exchangeApplied = settlement.exchangeApplied;
        exchangeExcessAmount = settlement.excessAmount;

        if (exchangeExcessAmount > 0) {
          const refundAmount = input.refund?.amount ?? 0;
          if (!input.refund || Math.abs(refundAmount - exchangeExcessAmount) > 1) {
            throw new RefundMismatchError(exchangeExcessAmount, refundAmount);
          }
        }

        // Same check addPayment() makes for an already-existing invoice -
        // done here too since this is the first point a brand new
        // exchange-settled invoice's paid_amount could be over-collected
        // against what's actually still due (grand_total - exchangeApplied),
        // not the raw grand_total the Zod schema's own looser refine checks.
        if (input.paid_amount > input.grand_total - exchangeApplied) {
          throw new PaymentExceedsBalanceError();
        }
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

      // Old jewellery purchase + items - created before the invoice so the
      // invoice document can reference purchaseId/purchaseNo directly.
      // linkedInvoiceId is filled in on the purchase afterward (see below
      // the invoice create call) - Mongo has no FK constraint forcing a
      // particular creation order, so a brief window where the purchase
      // exists without its invoice link is fine within one transaction
      // that either commits both or neither.
      let linkedOldPurchaseId: Types.ObjectId | null = null;
      let linkedOldPurchaseNo: string | null = null;

      if (hasExchange) {
        const purchaseNo = await getNextPurchaseNumber(year, session);
        const totalPurchaseValue = Math.round(
          input.old_jewellery_items.reduce((sum, item) => sum + item.final_value, 0),
        );

        const [purchase] = await OldJewelleryPurchaseModel.create(
          [
            {
              purchaseNo,
              customerId: customer._id,
              customer: {
                name: input.customer.name,
                phone: input.customer.phone,
                email: input.customer.email,
                address: input.customer.address,
              },
              source: "billing_exchange",
              linkedInvoiceId: null,
              totalPurchaseValue,
              appliedToInvoice: exchangeApplied,
              excessAmount: exchangeExcessAmount,
              excessSettlement: exchangeExcessAmount > 0 ? "refund" : null,
              refund:
                exchangeExcessAmount > 0 && input.refund
                  ? {
                      amount: input.refund.amount,
                      mode: input.refund.mode,
                      reference: input.refund.reference ?? null,
                      remarks: input.refund.remarks ?? null,
                      confirmedAt: new Date(),
                    }
                  : null,
              isDeleted: false,
              createdBy: null,
            },
          ],
          { session },
        );

        linkedOldPurchaseId = purchase._id;
        linkedOldPurchaseNo = purchase.purchaseNo;

        await OldJewelleryItemModel.create(
          input.old_jewellery_items.map((item, index) => ({
            purchaseId: purchase._id,
            srNo: index + 1,
            description: item.description,
            metal: item.metal,
            purity: item.purity,
            grossWtG: item.gross_wt_g,
            stoneWtG: item.stone_wt_g,
            dustWtG: item.dust_wt_g,
            otherDeductionWtG: item.other_deduction_wt_g,
            netWtG: item.net_wt_g,
            defaultRatePerGram: item.default_rate_per_gram,
            appliedRatePerGram: item.applied_rate_per_gram,
            calculatedValue: item.calculated_value,
            finalValue: item.final_value,
            overrideReason: item.override_reason ?? "",
            status: "IN_SHOP",
            statusHistory: [],
          })),
          // Mongoose 9.x throws "Cannot call create() with a session and
          // multiple documents unless ordered: true is set" otherwise -
          // only surfaced once an invoice actually had 2+ old jewellery
          // items (every earlier test had 0 or 1). Ordered is also the
          // behavior we want anyway - items should insert in srNo order.
          { session, ordered: true },
        );
      }

      // Omitted entirely (not set to null) when there's no real idempotency
      // key - a MongoDB sparse unique index only excludes documents where
      // the field is genuinely MISSING, not documents where it's present
      // with value null. Explicitly writing null here (the previous
      // behavior) made every ordinary invoice "present" in the index with
      // the same null value, so a second ordinary invoice would eventually
      // collide with a duplicate-key error - the exact bug hit on
      // OldJewelleryPurchase's identical operationId index.
      const operationIdField = hasExchange && input.operation_id ? { operationId: input.operation_id } : {};

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
              makingMethod: item.making_method,
              makingValue: item.making_value,
              stoneCharge: item.stone_charge,
              total: item.total,
            })),
            payments,
            subtotal: input.subtotal,
            discountAmount: input.discount_amount,
            gstPercent: input.gst_percent,
            gstAmount: input.gst_amount,
            cgstPercent: input.cgst_percent,
            sgstPercent: input.sgst_percent,
            cgstAmount: input.cgst_amount,
            sgstAmount: input.sgst_amount,
            grandTotal: input.grand_total,
            paidAmount: input.paid_amount,
            pendingAmount: input.pending_amount,
            paymentStatus: input.payment_status,
            exchangeApplied,
            linkedOldPurchaseId,
            linkedOldPurchaseNo,
            ...operationIdField,
          },
        ],
        { session },
      );

      if (linkedOldPurchaseId) {
        await OldJewelleryPurchaseModel.updateOne(
          { _id: linkedOldPurchaseId },
          { $set: { linkedInvoiceId: invoice._id } },
          { session },
        );
      }

      createdInvoice = invoice;
    });

    return createdInvoice!;
  } catch (error) {
    // Two truly-simultaneous requests with the same operation_id can both
    // pass the in-transaction idempotency check above (neither has
    // committed yet, so neither sees the other) - the operationId unique
    // index then rejects the second one's commit with a raw duplicate-key
    // error instead of a retryable WriteConflict. Same race/fix as
    // metalPuritiesService.ts's addPurity(). By the time this is caught,
    // the other transaction has already committed, so a plain read outside
    // the (now-aborted) session reliably finds it.
    if (
      hasExchange &&
      input.operation_id &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      const winner = await InvoiceModel.findOne({ operationId: input.operation_id });
      if (winner) return winner;
    }
    throw error;
  } finally {
    session.endSession();
  }
}

export interface ListInvoicesParams {
  page: number;
  limit: number;
  date?: string;
  from?: string;
  to?: string;
  customerId?: string;
  status?: "unpaid" | "partial" | "paid";
}

export async function listInvoices({ page, limit, date, from, to, customerId, status }: ListInvoicesParams) {
  const filter: QueryFilter<InvoiceDocument> = {};
  if (from && to) {
    filter.createdAt = {
      $gte: businessDayStart(from),
      $lte: businessDayEnd(to),
    };
  } else if (date) {
    filter.createdAt = {
      $gte: businessDayStart(date),
      $lte: businessDayEnd(date),
    };
  }
  // Same leniency as `date` above: a malformed id is silently ignored
  // (falls back to the unfiltered list) rather than a 500 - this route
  // doesn't validate its GET query params with Zod at all, so this
  // doesn't introduce a new validation style for just one param.
  if (customerId && Types.ObjectId.isValid(customerId)) {
    filter.customerId = new Types.ObjectId(customerId);
  }
  if (status) {
    filter.paymentStatus = status;
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

  // grandTotal - exchangeApplied, not the raw grandTotal - an exchange
  // already settles part (or all) of the bill, so a cash collection on top
  // of it must respect what's actually still due. exchangeApplied is 0 for
  // every ordinary invoice, so this is unchanged for the common case.
  if (input.paid_amount > invoice.grandTotal - invoice.exchangeApplied) {
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

// Reads the same OldJewelleryItem rows findOldJewelleryPurchaseById() would,
// but skips the purchase-document and linked-invoice-number lookups that
// route only needs for its own standalone receipt use case - the caller
// here already has the invoice (and its linked_old_purchase_no) in hand.
// Returns [] for both "no exchange on this invoice" (linkedOldPurchaseId is
// null - the overwhelming majority of invoices, no query at all) and "the
// purchase was somehow deleted out from under a still-linked invoice" (the
// query legitimately finds nothing) - neither is treated as an error, since
// an empty exchange table is exactly what should render either way. A real
// DB failure still throws and propagates to the route handler's existing
// try/catch, same as every other read in this file.
export async function findOldJewelleryExchangeItems(
  linkedOldPurchaseId: Types.ObjectId | null,
): Promise<ReturnType<typeof serializeOldJewelleryItemLine>[]> {
  if (!linkedOldPurchaseId) {
    return [];
  }

  const items = await OldJewelleryItemModel.find({ purchaseId: linkedOldPurchaseId }).sort({ srNo: 1 });
  return items.map(serializeOldJewelleryItemLine);
}

// Mirrors findOldJewelleryExchangeItems()'s shape/semantics: reads the one
// OldJewelleryPurchase document this invoice is linked to (if any) and
// returns only the two fields the detail/print pages need. null for every
// ordinary invoice (no linkedOldPurchaseId) and for every exchange that
// didn't exceed the bill (excessAmount <= 0) - both collapse to the same
// null so callers only ever need one branch, same reasoning as
// old_jewellery_items collapsing to []. A real DB failure still throws and
// propagates to the route handler's existing try/catch.
export async function findOldJewelleryExcessRefund(linkedOldPurchaseId: Types.ObjectId | null) {
  if (!linkedOldPurchaseId) {
    return null;
  }

  const purchase = await OldJewelleryPurchaseModel.findById(linkedOldPurchaseId).select("excessAmount refund");
  if (!purchase || purchase.excessAmount <= 0) {
    return null;
  }

  return {
    amount: purchase.excessAmount,
    refund: purchase.refund
      ? {
          amount: purchase.refund.amount,
          mode: purchase.refund.mode,
          reference: purchase.refund.reference ?? null,
          remarks: purchase.refund.remarks ?? null,
          confirmed_at: purchase.refund.confirmedAt.toISOString(),
        }
      : null,
  };
}

export type ExchangeSettlementType = "none" | "partial" | "exact" | "excess";

// Pure function, no DB access, cannot throw - a straightforward arithmetic
// classification over numbers the caller already has. Computed once here
// (not duplicated client-side in two different page components) so the
// detail page and print page can never classify the same invoice
// differently. exchangeApplied is capped at grandTotal server-side
// (min(oldJewelleryTotal, grandTotal)), so "exactly covers the bill" and
// "exceeds the bill" both show exchangeApplied === grandTotal - hasExcess
// (derived from findOldJewelleryExcessRefund's result) is what actually
// tells those two cases apart.
export function classifyExchangeSettlement(
  exchangeApplied: number,
  grandTotal: number,
  hasExcess: boolean,
): ExchangeSettlementType {
  if (exchangeApplied <= 0) return "none";
  if (hasExcess) return "excess";
  if (exchangeApplied < grandTotal) return "partial";
  return "exact";
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
      making_method: item.makingMethod,
      making_value: item.makingValue,
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
    cgst_percent: invoice.cgstPercent,
    sgst_percent: invoice.sgstPercent,
    cgst_amount: invoice.cgstAmount,
    sgst_amount: invoice.sgstAmount,
    grand_total: invoice.grandTotal,
    paid_amount: invoice.paidAmount,
    pending_amount: invoice.pendingAmount,
    payment_status: invoice.paymentStatus,
    exchange_applied: invoice.exchangeApplied,
    linked_old_purchase_id: invoice.linkedOldPurchaseId?.toString() ?? null,
    linked_old_purchase_no: invoice.linkedOldPurchaseNo,
    created_at: invoice.createdAt.toISOString(),
  };
}
