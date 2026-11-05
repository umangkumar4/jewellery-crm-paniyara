import { apiClient, ApiError } from "@/lib/api-client";
import { createLabelPrinter } from "@/features/tagging/lib/labelPrinter";

type Qz = typeof import("qz-tray").default;

const isNotConfigured = (error: unknown) => error instanceof ApiError && error.status === 404;

// Signing removes QZ Tray's Allow prompts. If it isn't set up on the server the
// requests just go unsigned and QZ Tray shows the prompt instead, so 404 isn't
// an error here. Any other failure is, because a request that was meant to be
// signed shouldn't quietly turn into a prompt nobody expects.
function configureSigning(qz: Qz) {
  qz.security.setSignatureAlgorithm("SHA512");

  qz.security.setCertificatePromise((resolve, reject) => {
    apiClient
      .get<{ certificate: string }>("/print/certificate")
      .then(({ certificate }) => resolve(certificate))
      .catch((error) => (isNotConfigured(error) ? resolve(null) : reject(error)));
  });

  qz.security.setSignaturePromise((request) => (resolve, reject) => {
    apiClient
      .post<{ signature: string }>("/print/sign", { request })
      .then(({ signature }) => resolve(signature))
      .catch((error) => (isNotConfigured(error) ? resolve("") : reject(error)));
  });
}

let loadedQz: Promise<Qz> | null = null;

function loadQz(): Promise<Qz> {
  loadedQz ??= import("qz-tray").then(({ default: qz }) => {
    configureSigning(qz);
    return qz;
  });
  return loadedQz;
}

export const printRawLabel = createLabelPrinter(loadQz);
