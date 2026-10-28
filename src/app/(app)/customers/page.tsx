import { CustomersTable } from "@/features/customers/components/CustomersTable";
import { PageHeader } from "@/components/layout/PageHeader";

export default function CustomersPage() {
  return (
    <div className="mx-auto max-w-full">
      <PageHeader title="Customers" description="Look up a customer and view their purchase history." />

      <div className="mt-6">
        <CustomersTable />
      </div>
    </div>
  );
}
