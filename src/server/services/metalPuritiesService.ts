import { MetalPurityModel, type MetalPurityDocument } from "@/models/MetalPurity.model";
import { TagModel } from "@/models/Tag.model";
import type { CreatePurityInput } from "@/schemas/purity.schema";
import type { SetMetalRateInput } from "@/schemas/metal-rate.schema";

export class PurityAlreadyExistsError extends Error {
  constructor() {
    super("This purity already exists for this metal");
    this.name = "PurityAlreadyExistsError";
  }
}

export class PurityNotFoundError extends Error {
  constructor() {
    super("No such purity");
    this.name = "PurityNotFoundError";
  }
}

export class PurityInUseError extends Error {
  count: number;

  constructor(count: number) {
    const verb = count === 1 ? "uses" : "use";
    super(`${count} tag${count === 1 ? "" : "s"} ${verb} this purity - archive it instead`);
    this.name = "PurityInUseError";
    this.count = count;
  }
}

export async function listMetalPurities(params: { metal?: string; includeInactive?: boolean } = {}) {
  const filter: Record<string, unknown> = {};
  if (params.metal) filter.metal = params.metal;
  if (!params.includeInactive) filter.active = true;

  return MetalPurityModel.find(filter).sort({ metal: 1, purity: 1 });
}

export async function addPurity(input: CreatePurityInput) {
  const existing = await MetalPurityModel.findOne({ metal: input.metal, purity: input.purity });

  if (existing) {
    if (existing.active) {
      throw new PurityAlreadyExistsError();
    }
    existing.active = true;
    await existing.save();
    return existing;
  }

  try {
    return await MetalPurityModel.create({
      metal: input.metal,
      purity: input.purity,
      ratePerGram: null,
      active: true,
    });
  } catch (error) {
    // Two concurrent requests can both pass the findOne check above before
    // either commits - the unique {metal, purity} index then rejects the
    // second insert with a raw duplicate-key error. Same race/fix as
    // authService.ts's registerUser().
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new PurityAlreadyExistsError();
    }
    throw error;
  }
}

export async function renamePurity(id: string, purity: string) {
  const doc = await MetalPurityModel.findById(id);
  if (!doc) throw new PurityNotFoundError();

  const collision = await MetalPurityModel.findOne({
    _id: { $ne: doc._id },
    metal: doc.metal,
    purity,
  });
  if (collision) throw new PurityAlreadyExistsError();

  doc.purity = purity;
  await doc.save();
  return doc;
}

export async function setPurityActive(id: string, active: boolean) {
  const doc = await MetalPurityModel.findByIdAndUpdate(id, { active }, { new: true });
  if (!doc) throw new PurityNotFoundError();
  return doc;
}

export async function deletePurity(id: string) {
  const doc = await MetalPurityModel.findById(id);
  if (!doc) throw new PurityNotFoundError();

  const count = await TagModel.countDocuments({ purityId: doc._id });
  if (count > 0) throw new PurityInUseError(count);

  await doc.deleteOne();
}

export async function setRate(input: SetMetalRateInput) {
  return MetalPurityModel.findOneAndUpdate(
    { metal: input.metal, purity: input.purity },
    { ratePerGram: input.rate_per_gram, purchaseRatePerGram: input.purchase_rate_per_gram },
    { new: true },
  );
}

export function serializeMetalPurity(doc: MetalPurityDocument) {
  return {
    id: doc._id.toString(),
    metal: doc.metal,
    purity: doc.purity,
    rate_per_gram: doc.ratePerGram,
    purchase_rate_per_gram: doc.purchaseRatePerGram,
    active: doc.active,
    updated_at: doc.updatedAt.toISOString(),
  };
}
