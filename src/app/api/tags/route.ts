import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { createTagSchema } from "@/schemas/tag.schema";
import type { TagStatus } from "@/models/Tag.model";
import {
  createTag,
  listTags,
  serializeTag,
  TagCodeGenerationError,
} from "@/server/services/tagsService";
import { PurityNotFoundError } from "@/server/services/metalPuritiesService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

const TAG_STATUSES: TagStatus[] = ["tagged", "sold"];

export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);

  const pageParam = Number(searchParams.get("page"));
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam >= 1 ? Math.min(Math.floor(limitParam), 100) : 20;

  const q = searchParams.get("q")?.trim() || undefined;

  const statusParam = searchParams.get("status");
  const status = TAG_STATUSES.includes(statusParam as TagStatus) ? (statusParam as TagStatus) : undefined;

  await dbConnect();

  try {
    const { items, total } = await listTags({ page, limit, q, status });
    return Response.json({ data: items.map(serializeTag), total, page });
  } catch (error) {
    logger.error({ error }, "Failed to list tags");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();

  try {
    const tag = await createTag(parsed.data);
    return Response.json(serializeTag(tag), { status: 201 });
  } catch (error) {
    if (error instanceof PurityNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof TagCodeGenerationError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    logger.error({ error }, "Failed to create tag");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
