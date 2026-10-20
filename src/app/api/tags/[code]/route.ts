import { dbConnect } from "@/lib/db/mongoose";
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

  return Response.json(serializeTag(tag));
}
