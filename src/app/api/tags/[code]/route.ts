import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { findTagByCode, serializeTag } from "@/server/services/tagsService";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  await dbConnect();
  const { code } = await params;

  const tag = await findTagByCode(code);
  if (!tag) {
    return Response.json({ error: "No tag with this code" }, { status: 404 });
  }
  if (tag.status === "sold") {
    return Response.json({ error: "This tag is already sold" }, { status: 409 });
  }

  try {
    return Response.json(serializeTag(tag));
  } catch (error) {
    logger.error({ error }, "Failed to serialize tag");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
