"use client";

import { useParams } from "next/navigation";
import { PrintInvoice } from "@/features/billing/components/PrintInvoice";

// A Client Component, not the Server Component frontend_setup.md §6.2
// originally suggested - the session token lives only in sessionStorage
// (decision #8), so a server-rendered page has no way to attach it to the
// request. Every protected page in this app fetches client-side for the
// same reason; this one is no exception. All actual fetching/rendering
// lives in PrintInvoice - any other page can mount the same component with
// just an id, not only this dedicated print route.
export default function InvoicePrintPage() {
  const params = useParams<{ id: string }>();
  return <PrintInvoice id={params.id} />;
}
