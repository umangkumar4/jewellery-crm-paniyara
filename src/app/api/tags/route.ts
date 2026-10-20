import { z } from "zod";
import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { createTagSchema } from "@/schemas/tag.schema";
import { createTag, serializeTag, TagCodeGenerationError } from "@/server/services/tagsService";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    const fields = Object.fromEntries(
      Object.entries(flattened.fieldErrors).map(([key, messages]) => [
        key,
        messages?.[0] ?? "Invalid value",
      ]),
    );
    return Response.json({ error: "Validation failed", fields }, { status: 422 });
  }

  await dbConnect();

  try {
    const tag = await createTag(parsed.data);
    return Response.json(serializeTag(tag), { status: 201 });
  } catch (error) {
    if (error instanceof TagCodeGenerationError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    logger.error({ error }, "Failed to create tag");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
