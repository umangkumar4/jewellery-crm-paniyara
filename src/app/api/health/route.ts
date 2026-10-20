import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const mongoose = await dbConnect();
    return Response.json({
      status: "ok",
      db: mongoose.connection.readyState === 1 ? "connected" : "connecting",
    });
  } catch (error) {
    logger.error({ error }, "Health check failed to connect to MongoDB");
    return Response.json({ status: "error", db: "disconnected" }, { status: 500 });
  }
}
