import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { deleteTagByCode, findTagByCode, serializeTag } from "@/server/services/tagsService";

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

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  await dbConnect();
  const { code } = await params;

  try {
    const result = await deleteTagByCode(code);
    if (!result.deleted) {
      if (result.reason === "not_found") {
        return Response.json({ error: "No tag with this code" }, { status: 404 });
      }
      return Response.json({ error: "This tag is already sold and cannot be deleted" }, { status: 409 });
    }
    return Response.json({ message: `Tag ${code.toUpperCase()} deleted` });
  } catch (error) {
    logger.error({ error }, "Failed to delete tag");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
