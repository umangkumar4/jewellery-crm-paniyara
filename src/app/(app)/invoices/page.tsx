import { InvoiceTable } from "@/features/dashboard/components/InvoiceTable";

export default function InvoicesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="font-display text-2xl text-foreground">Invoices</h2>
      <p className="mt-1 text-sm text-muted-foreground">Every sale recorded through Billing.</p>

      <div className="mt-6">
        <InvoiceTable />
      </div>
    </div>
  );
}
