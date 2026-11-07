import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  SETUP_SECRET: z.string().min(1, "SETUP_SECRET is required"),
  // Optional on purpose: this check stops the whole app when it fails, and
  // silent label printing isn't worth taking billing down for. Without them,
  // QZ Tray just asks staff to click Allow (see qzSigningService.ts).
  QZ_CERTIFICATE: z.string().optional(),
  QZ_PRIVATE_KEY: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
    throw new Error(`Invalid environment configuration:\n  ${fields}`);
  }

  return parsed.data;
}

export const env = loadEnv();
