import { InvoiceGrid } from "@/features/dashboard/components/InvoiceGrid";
import { BackButton } from "@/components/layout/BackButton";

export default function InvoicesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <BackButton />

      <h2 className="font-display text-2xl text-foreground">Invoices</h2>
      <p className="mt-1 text-sm text-muted-foreground">Every sale recorded through Billing.</p>

      <div className="mt-6">
        <InvoiceGrid />
      </div>
    </div>
  );
}
