import mongoose, { Types, type ClientSession } from "mongoose";
import { OldJewelleryPurchaseModel, type OldJewelleryPurchaseDocument } from "@/models/OldJewelleryPurchase.model";
import {
  OldJewelleryItemModel,
  type OldJewelleryItemDocument,
  type OldJewelleryItemStatus,
} from "@/models/OldJewelleryItem.model";
import { InvoiceModel } from "@/models/Invoice.model";
import { PurchaseCounterModel } from "@/models/PurchaseCounter.model";
import { CustomerModel } from "@/models/Customer.model";
import type { ChangeOldJewelleryItemStatusInput } from "@/schemas/oldJewelleryItem.schema";
import type { CreateStandaloneOldJewelleryPurchaseInput } from "@/schemas/standaloneOldJewelleryPurchase.schema";

export class OldJewelleryItemNotFoundError extends Error {
  constructor() {
    super("No old jewellery item with this id");
    this.name = "OldJewelleryItemNotFoundError";
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(public readonly currentStatus: OldJewelleryItemStatus) {
    super(`Item is already ${currentStatus} - only IN_SHOP items can change status`);
    this.name = "InvalidStatusTransitionError";
  }
}

export interface OldJewelleryPurchaseWithItems {
  purchase: OldJewelleryPurchaseDocument;
  items: OldJewelleryItemDocument[];
  linkedInvoiceNo: string | null;
}

// Same findInvoiceById convention - a malformed id returns null (a clean
// 404 for every caller) rather than letting Mongoose throw a raw CastError
// (which would otherwise surface as a 500 for "someone typo'd the URL").
export async function findOldJewelleryPurchaseById(id: string): Promise<OldJewelleryPurchaseWithItems | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  const purchase = await OldJewelleryPurchaseModel.findById(id);
  if (!purchase) {
    return null;
  }

  const items = await OldJewelleryItemModel.find({ purchaseId: purchase._id }).sort({ srNo: 1 });

  // A second, lightweight query rather than .populate() - this is a
  // low-traffic print page, not a hot path, and keeps the purchase
  // document's own shape exactly as stored rather than mixing in a
  // populated sub-document.
  let linkedInvoiceNo: string | null = null;
  if (purchase.linkedInvoiceId) {
    const invoice = await InvoiceModel.findById(purchase.linkedInvoiceId).select("invoiceNo");
    linkedInvoiceNo = invoice?.invoiceNo ?? null;
  }

  return { purchase, items, linkedInvoiceNo };
}

// Pulled out of serializeOldJewelleryPurchase() so invoicesService.ts can
// reuse the exact same per-item shape when embedding a billing-exchange
// invoice's old jewellery items into its own response, instead of
// duplicating this mapping a second time.
export function serializeOldJewelleryItemLine(item: OldJewelleryItemDocument) {
  return {
    sr_no: item.srNo,
    description: item.description,
    metal: item.metal,
    purity: item.purity,
    gross_wt_g: item.grossWtG,
    stone_wt_g: item.stoneWtG,
    dust_wt_g: item.dustWtG,
    other_deduction_wt_g: item.otherDeductionWtG,
    net_wt_g: item.netWtG,
    applied_rate_per_gram: item.appliedRatePerGram,
    calculated_value: item.calculatedValue,
    final_value: item.finalValue,
    override_reason: item.overrideReason,
    status: item.status,
  };
}

export function serializeOldJewelleryPurchase({ purchase, items, linkedInvoiceNo }: OldJewelleryPurchaseWithItems) {
  return {
    id: purchase._id.toString(),
    purchase_no: purchase.purchaseNo,
    customer_id: purchase.customerId.toString(),
    customer: {
      name: purchase.customer.name,
      phone: purchase.customer.phone,
      email: purchase.customer.email,
      address: purchase.customer.address,
    },
    source: purchase.source,
    linked_invoice_id: purchase.linkedInvoiceId?.toString() ?? null,
    linked_invoice_no: linkedInvoiceNo,
    items: items.map(serializeOldJewelleryItemLine),
    total_purchase_value: purchase.totalPurchaseValue,
    applied_to_invoice: purchase.appliedToInvoice,
    excess_amount: purchase.excessAmount,
    excess_settlement: purchase.excessSettlement,
    refund: purchase.refund
      ? {
          amount: purchase.refund.amount,
          mode: purchase.refund.mode,
          reference: purchase.refund.reference ?? null,
          remarks: purchase.refund.remarks ?? null,
          confirmed_at: purchase.refund.confirmedAt.toISOString(),
        }
      : null,
    is_deleted: purchase.isDeleted,
    created_at: purchase.createdAt.toISOString(),
  };
}

export interface ListOldJewelleryItemsOptions {
  status?: OldJewelleryItemStatus;
  page: number;
  limit: number;
}

export interface ListOldJewelleryItemsResult {
  items: OldJewelleryItemDocument[];
  total: number;
  page: number;
  limit: number;
}

// Populated purely for the list view's "Purchase No" column - the detail
// page (findOldJewelleryPurchaseById above) already has its own lightweight
// linkedInvoiceNo lookup and doesn't need this.
export async function listOldJewelleryItems({
  status,
  page,
  limit,
}: ListOldJewelleryItemsOptions): Promise<ListOldJewelleryItemsResult> {
  const filter = status ? { status } : {};

  const [items, total] = await Promise.all([
    OldJewelleryItemModel.find(filter)
      .populate<{ purchaseId: OldJewelleryPurchaseDocument }>("purchaseId", "purchaseNo")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    OldJewelleryItemModel.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

export function serializeOldJewelleryItemListRow(item: OldJewelleryItemDocument) {
  // purchaseId is guaranteed populated here - listOldJewelleryItems always
  // calls .populate("purchaseId", "purchaseNo") above, same defensive
  // convention as tagsService.ts's serializeTag() for purityId.
  const purchase = item.purchaseId;
  if (purchase instanceof Types.ObjectId) {
    throw new Error("Expected purchaseId to be populated");
  }

  return {
    id: item._id.toString(),
    purchase_no: purchase.purchaseNo,
    description: item.description,
    metal: item.metal,
    purity: item.purity,
    net_wt_g: item.netWtG,
    final_value: item.finalValue,
    status: item.status,
    status_history: item.statusHistory.map((change) => ({
      from: change.from,
      to: change.to,
      reason: change.reason,
      changed_at: change.changedAt.toISOString(),
    })),
  };
}

// Only IN_SHOP items can transition, and only to DISPOSED or MELTED - once
// an item leaves IN_SHOP it is a terminal state (no reverting, no further
// transitions), matching the plan's deliberately simple status model.
export async function changeOldJewelleryItemStatus(
  id: string,
  input: ChangeOldJewelleryItemStatusInput,
): Promise<OldJewelleryItemDocument> {
  if (!Types.ObjectId.isValid(id)) {
    throw new OldJewelleryItemNotFoundError();
  }

  const item = await OldJewelleryItemModel.findById(id);
  if (!item) {
    throw new OldJewelleryItemNotFoundError();
  }

  if (item.status !== "IN_SHOP") {
    throw new InvalidStatusTransitionError(item.status);
  }

  item.statusHistory.push({
    from: item.status,
    to: input.status,
    reason: input.reason,
    changedBy: null,
    changedAt: new Date(),
  });
  item.status = input.status;

  await item.save();
  // The route serializes this with serializeOldJewelleryItemListRow(), which
  // requires purchaseId populated (same convention as listOldJewelleryItems()
  // above) - findById() above doesn't populate, so this item would otherwise
  // throw "Expected purchaseId to be populated" at the route layer.
  await item.populate<{ purchaseId: OldJewelleryPurchaseDocument }>("purchaseId", "purchaseNo");
  return item;
}

// Same counter model/format as invoicesService.ts's own getNextPurchaseNumber
// (private there, for the billing_exchange path) - each service owns its own
// copy of this tiny helper rather than importing a private function across
// service modules, same precedent as metalPuritiesService.ts's own counter
// helpers.
async function getNextPurchaseNumber(year: number, session: ClientSession): Promise<string> {
  const counter = await PurchaseCounterModel.findByIdAndUpdate(
    year,
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true, session },
  );
  const sequence = String(counter.lastNumber).padStart(4, "0");
  return `OJP-${year}-${sequence}`;
}

// Sell-without-buy: the shop buys old jewellery with no linked sale, so the
// entire item total is paid out as a refund - there's no grand_total to
// settle against first, unlike invoicesService.ts's createInvoice() exchange
// path. Mirrors that function's transaction shape (idempotency check,
// customer upsert, counter, create) without any of the invoice/tag/GST
// machinery that doesn't apply here.
export async function createStandaloneOldJewelleryPurchase(
  input: CreateStandaloneOldJewelleryPurchaseInput,
): Promise<OldJewelleryPurchaseDocument> {
  const session = await mongoose.startSession();
  let createdPurchase: OldJewelleryPurchaseDocument | undefined;

  try {
    await session.withTransaction(async () => {
      const existing = await OldJewelleryPurchaseModel.findOne({ operationId: input.operation_id }).session(
        session,
      );
      if (existing) {
        createdPurchase = existing;
        return;
      }

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

      const year = new Date().getFullYear();
      const purchaseNo = await getNextPurchaseNumber(year, session);
      const totalPurchaseValue = Math.round(input.items.reduce((sum, item) => sum + item.final_value, 0));

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
            source: "standalone",
            linkedInvoiceId: null,
            totalPurchaseValue,
            appliedToInvoice: 0,
            excessAmount: totalPurchaseValue,
            excessSettlement: "refund",
            refund: {
              amount: input.refund.amount,
              mode: input.refund.mode,
              reference: input.refund.reference ?? null,
              remarks: input.refund.remarks ?? null,
              confirmedAt: new Date(),
            },
            isDeleted: false,
            createdBy: null,
            operationId: input.operation_id,
          },
        ],
        { session },
      );

      await OldJewelleryItemModel.create(
        input.items.map((item, index) => ({
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
        // multiple documents unless ordered: true is set" otherwise - same
        // fix as invoicesService.ts's createInvoice(), needed here too
        // since this is the identical multi-item-create-in-a-session shape.
        { session, ordered: true },
      );

      createdPurchase = purchase;
    });

    return createdPurchase!;
  } catch (error) {
    // Same concurrent-duplicate-operation_id race/fix as invoicesService.ts's
    // createInvoice() - two truly-simultaneous submits can both pass the
    // in-transaction check above before either commits, so the second one's
    // commit hits the unique index instead of a retryable WriteConflict.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      const winner = await OldJewelleryPurchaseModel.findOne({ operationId: input.operation_id });
      if (winner) return winner;
    }
    throw error;
  } finally {
    session.endSession();
  }
}
