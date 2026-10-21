"use client";

import { useParams } from "next/navigation";
import { IndianRupee, Mail, MapPin, Phone, Receipt, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomer } from "@/features/customers/hooks/useCustomer";
import { InvoiceTable } from "@/features/dashboard/components/InvoiceTable";
import { formatInr } from "@/lib/formatters";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: customer, isLoading, isError } = useCustomer(id);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (isError || !customer) {
    return <p className="text-sm text-destructive">Customer not found.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="font-display text-2xl text-foreground">{customer.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Customer since {new Date(customer.created_at).toLocaleDateString("en-IN")}
        </p>
      </div>

      <Card className="shadow-[var(--shadow-jewel)]">
        <CardHeader>
          <CardTitle className="font-display text-lg text-foreground">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Phone className="h-4 w-4 text-muted-foreground" />
            {customer.phone}
          </div>
          {customer.email ? (
            <div className="flex items-center gap-2 text-foreground">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {customer.email}
            </div>
          ) : null}
          {customer.address ? (
            <div className="flex items-center gap-2 text-foreground">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {customer.address}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="gap-2 py-4 shadow-[var(--shadow-jewel)]">
          <CardContent className="px-4">
            <Receipt className="h-5 w-5 text-gold" />
            <div className="mt-3 text-xl font-semibold text-foreground">{customer.stats.invoice_count}</div>
            <div className="text-xs text-muted-foreground">Invoices</div>
          </CardContent>
        </Card>
        <Card className="gap-2 py-4 shadow-[var(--shadow-jewel)]">
          <CardContent className="px-4">
            <IndianRupee className="h-5 w-5 text-gold" />
            <div className="mt-3 text-xl font-semibold text-foreground">
              {formatInr(customer.stats.total_purchased)}
            </div>
            <div className="text-xs text-muted-foreground">Total Purchased</div>
          </CardContent>
        </Card>
        <Card className="gap-2 py-4 shadow-[var(--shadow-jewel)]">
          <CardContent className="px-4">
            <Wallet className="h-5 w-5 text-gold" />
            <div className="mt-3 text-xl font-semibold text-foreground">
              {formatInr(customer.stats.pending_amount)}
            </div>
            <div className="text-xs text-muted-foreground">Pending Amount</div>
          </CardContent>
        </Card>
      </div>

      <InvoiceTable customerId={id} title="Purchase History" />
    </div>
  );
}
