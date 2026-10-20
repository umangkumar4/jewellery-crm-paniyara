import { customAlphabet } from "nanoid";
import type { QueryFilter } from "mongoose";
import { TagModel, type TagDocument, type TagStatus } from "@/models/Tag.model";
import type { CreateTagInput } from "@/schemas/tag.schema";

const generateCodeSuffix = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

export class TagCodeGenerationError extends Error {
  constructor() {
    super("Could not generate a unique tag code, please try again");
    this.name = "TagCodeGenerationError";
  }
}

async function generateUniqueTagCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `TAG-${generateCodeSuffix()}`;
    const existing = await TagModel.findOne({ code }).select("_id").lean();
    if (!existing) return code;
  }
  throw new TagCodeGenerationError();
}

export async function createTag(input: CreateTagInput) {
  const code = await generateUniqueTagCode();

  const tag = await TagModel.create({
    code,
    productName: input.product_name,
    metal: input.metal,
    purity: input.purity,
    grossWtG: input.gross_wt_g,
    stoneWtG: input.stone_wt_g,
    netWtG: input.net_wt_g,
  });

  return tag;
}

export async function findTagByCode(code: string) {
  return TagModel.findOne({ code: code.toUpperCase() });
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
      .limit(limit),
    TagModel.countDocuments(filter),
  ]);

  return { items, total };
}

export function serializeTag(tag: TagDocument) {
  return {
    id: tag._id.toString(),
    code: tag.code,
    product_name: tag.productName,
    metal: tag.metal,
    purity: tag.purity,
    gross_wt_g: tag.grossWtG,
    stone_wt_g: tag.stoneWtG,
    net_wt_g: tag.netWtG,
    status: tag.status,
    created_at: tag.createdAt.toISOString(),
  };
}
