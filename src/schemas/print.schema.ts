import { z } from "zod";

// QZ Tray asks for a signature over the SHA-256 hash of each request, never the
// request itself, so anything but a hash isn't a real signing request.
export const qzSignSchema = z.object({
  request: z.string().regex(/^[0-9a-f]{64}$/i, "Invalid signing request"),
});
