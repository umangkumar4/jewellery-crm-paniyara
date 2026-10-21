import { CustomersTable } from "@/features/customers/components/CustomersTable";

export default function CustomersPage() {
  return (
    <div className="mx-auto max-w-full">
      <h2 className="font-display text-2xl text-foreground">Customers</h2>
      <p className="mt-1 text-sm text-muted-foreground">Look up a customer and view their purchase history.</p>

      <div className="mt-6">
        <CustomersTable />
      </div>
    </div>
  );
}
