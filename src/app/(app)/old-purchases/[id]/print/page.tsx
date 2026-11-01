"use client";

import { useParams } from "next/navigation";
import { PrintOldJewelleryPurchase } from "@/features/billing/components/PrintOldJewelleryPurchase";

// Mirrors invoices/[id]/print/page.tsx exactly - a thin Client Component
// wrapper (the session token lives in sessionStorage, not a cookie, so a
// Server Component has no way to attach it to the request). All fetching/
// rendering lives in PrintOldJewelleryPurchase.
export default function OldJewelleryPurchasePrintPage() {
  const params = useParams<{ id: string }>();
  return <PrintOldJewelleryPurchase id={params.id} />;
}
