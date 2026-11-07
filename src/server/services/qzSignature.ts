import { createSign } from "node:crypto";

// Hosting settings often store a multi-line PEM with literal "\n" sequences.
export function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

// QZ Tray checks this against the certificate installed on each shop PC, using
// the SHA512 algorithm set in qzClient.ts.
export function signQzRequest(data: string, privateKeyPem: string): string {
  return createSign("RSA-SHA512").update(data).sign(privateKeyPem, "base64");
}
