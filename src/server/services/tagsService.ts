import type { QueryFilter } from "mongoose";
import { TagModel, type TagDocument, type TagStatus } from "@/models/Tag.model";
import { TagCounterModel } from "@/models/TagCounter.model";
import { MetalPurityModel, type MetalPurityDocument } from "@/models/MetalPurity.model";
import { PurityNotFoundError } from "@/server/services/metalPuritiesService";
import type { CreateTagInput } from "@/schemas/tag.schema";
import { formatTagCode, MAX_TAG_SEQUENCE } from "@/lib/tag-code";

const TAG_COUNTER_ID = "tag";

export class TagCodeGenerationError extends Error {
  constructor() {
    super("Tag code limit reached, no new tags can be created");
    this.name = "TagCodeGenerationError";
  }
}

// Same atomic $inc as getNextInvoiceNumber() in invoicesService.ts, so two
// staff creating tags at once can never get the same number. No session here
// because createTag isn't a transaction: a failed create just skips a number,
// which is harmless for tags, and a deleted tag's number is never reused.
async function getNextTagCode(): Promise<string> {
  const counter = await TagCounterModel.findByIdAndUpdate(
    TAG_COUNTER_ID,
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true },
  );
  if (counter.lastNumber > MAX_TAG_SEQUENCE) {
    throw new TagCodeGenerationError();
  }
  return formatTagCode(counter.lastNumber);
}

export async function createTag(input: CreateTagInput) {
  // Tagging only ever picks an existing, active purity (the dropdown never
  // offers anything else) - re-checked here server-side rather than trusted
  // from the client, same as every other validated input in this app.
  const purity = await MetalPurityModel.findById(input.purity_id);
  if (!purity || !purity.active) {
    throw new PurityNotFoundError();
  }

  const code = await getNextTagCode();

  const tag = await TagModel.create({
    code,
    productName: input.product_name,
    purityId: purity._id,
    grossWtG: input.gross_wt_g,
    stoneWtG: input.stone_wt_g,
    netWtG: input.net_wt_g,
    buyerCode: input.buyer_code ?? "",
    stoneAmountMethod: input.stone_amount_method,
    totalStoneAmount: input.total_stone_amount,
    stoneAmount: input.stone_amount,
  });

  tag.purityId = purity;
  return tag;
}

export async function findTagByCode(code: string) {
  return TagModel.findOne({ code: code.toUpperCase() }).populate("purityId");
}

export interface ListTagsParams {
  page: number;
  limit: number;
  q?: string;
  status?: TagStatus;
}

export async function listTags({ page, limit, q, status }: ListTagsParams) {
  const filter: QueryFilter<TagDocument> = {};
  if (status) filter.status = status;
  if (q) {
    // q is user input - escape regex metacharacters before using it in a RegExp.
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ productName: regex }, { code: regex }];
  }

  const [items, total] = await Promise.all([
    TagModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("purityId"),
    TagModel.countDocuments(filter),
  ]);

  return { items, total };
}

// Atomic find+delete, gated to "tagged" status inside the same Mongo
// operation - not a separate find-then-delete - so a tag can never be
// deleted in the narrow window between being sold and this request
// landing. Returns a discriminated result rather than throwing: the "not
// found" vs "already sold" distinction mirrors GET /api/tags/[code]'s own
// inline check (see that route), and avoids a second, differently-shaped
// TagNotFoundError/TagAlreadySoldError colliding in name with the ones
// invoicesService.ts already defines for a different domain.
export async function deleteTagByCode(code: string) {
  const normalizedCode = code.toUpperCase();
  const deleted = await TagModel.findOneAndDelete({ code: normalizedCode, status: "tagged" });
  if (deleted) return { deleted: true as const };

  // Delete already definitively didn't happen above - this lookup is only
  // to give the caller an accurate 404 vs 409, not a correctness step.
  const existing = await TagModel.findOne({ code: normalizedCode }).select("_id").lean();
  return { deleted: false as const, reason: existing ? ("sold" as const) : ("not_found" as const) };
}

export function serializeTag(tag: TagDocument) {
  const purity = tag.purityId;
  if (!purity || !(purity instanceof Object) || !("metal" in purity)) {
    throw new Error("serializeTag() called on a tag whose purityId wasn't populated");
  }
  const populatedPurity = purity as MetalPurityDocument;

  return {
    id: tag._id.toString(),
    code: tag.code,
    product_name: tag.productName,
    metal: populatedPurity.metal,
    purity: populatedPurity.purity,
    purity_id: populatedPurity._id.toString(),
    gross_wt_g: tag.grossWtG,
    stone_wt_g: tag.stoneWtG,
    net_wt_g: tag.netWtG,
    rate_per_gram: populatedPurity.ratePerGram,
    status: tag.status,
    buyer_code: tag.buyerCode ?? "",
    stone_amount_method: tag.stoneAmountMethod ?? "not_set",
    total_stone_amount: tag.totalStoneAmount ?? 0,
    stone_amount: tag.stoneAmount ?? 0,
    created_at: tag.createdAt.toISOString(),
  };
}
