import { env } from "@/lib/env";
import { normalizePem } from "@/server/services/qzSignature";

// Both or neither: a certificate QZ Tray can't get matching signatures for
// would be worse than plain unsigned printing, which just shows a prompt.
export function getQzSigningConfig(): { certificate: string; privateKey: string } | null {
  if (!env.QZ_CERTIFICATE?.trim() || !env.QZ_PRIVATE_KEY?.trim()) return null;
  return {
    certificate: normalizePem(env.QZ_CERTIFICATE),
    privateKey: normalizePem(env.QZ_PRIVATE_KEY),
  };
}
