import { InvoiceGrid } from "@/features/dashboard/components/InvoiceGrid";
import { PageHeader } from "@/components/layout/PageHeader";

export default function InvoicesPage() {
  return (
    <div className="mx-2 max-w-full">
      <PageHeader title="Invoices" description="Every sale recorded through Billing." />

      <div className="mt-6">
        <InvoiceGrid />
      </div>
    </div>
  );
}
