import { dbConnect } from "@/lib/db/mongoose";
import { requireAuth } from "@/server/auth/session";
import { findTagByCode, serializeTag } from "@/server/services/tagsService";

export const dynamic = "force-dynamic";

/**
 * Label preview payload for barcode/thermal label printing - the barcode
 * itself is drawn client-side from `code` (jsbarcode, see
 * docs/frontend_setup.md §6.1), so this just supplies the tag's data. No
 * sold-status check here (unlike GET /api/tags/:code): reprinting a label
 * for a sold tag's audit trail is a legitimate use, not a billing scan.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  await dbConnect();
  const { code } = await params;

  const tag = await findTagByCode(code);
  if (!tag) {
    return Response.json({ error: "No tag with this code" }, { status: 404 });
  }

  return Response.json(serializeTag(tag));
}
