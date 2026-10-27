"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useCustomerLookup } from "@/features/billing/hooks/useCustomerLookup";
import { useOldPurchaseStore } from "@/store/useOldPurchaseStore";

const PHONE_PATTERN = /^\d{10}$/;

// Same phone-lookup UX as billing's CustomerFields.tsx, reading/writing
// useOldPurchaseStore instead - kept as a separate component rather than
// parameterizing CustomerFields.tsx with a second store, so the billing
// flow's own component stays untouched. useCustomerLookup itself is already
// store-agnostic (plain React Query hook), reused as-is.
export function StandaloneCustomerFields() {
  const customer = useOldPurchaseStore((state) => state.customer);
  const setCustomer = useOldPurchaseStore((state) => state.setCustomer);
  const fieldErrors = useOldPurchaseStore((state) => state.fieldErrors);

  const trimmedPhone = customer.phone.trim();
  const isCompletePhone = PHONE_PATTERN.test(trimmedPhone);

  const [debouncedPhone, setDebouncedPhone] = useState("");
  const [appliedPhone, setAppliedPhone] = useState<string | null>(null);

  const [prevCompletePhone, setPrevCompletePhone] = useState(isCompletePhone);
  if (prevCompletePhone !== isCompletePhone) {
    setPrevCompletePhone(isCompletePhone);
    if (!isCompletePhone) {
      setDebouncedPhone("");
    }
  }

  useEffect(() => {
    if (!isCompletePhone) return;
    const timer = setTimeout(() => setDebouncedPhone(trimmedPhone), 300);
    return () => clearTimeout(timer);
  }, [trimmedPhone, isCompletePhone]);

  const { data: found, isFetching } = useCustomerLookup(debouncedPhone);
  const lookupReady = isCompletePhone && debouncedPhone === trimmedPhone;

  const applyFound = () => {
    if (!found) return;
    setCustomer({
      name: found.name,
      phone: customer.phone,
      email: found.email ?? "",
      address: found.address ?? "",
    });
    setAppliedPhone(trimmedPhone);
  };

  let status: ReactNode = null;
  if (trimmedPhone.length > 0 && !isCompletePhone) {
    status = (
      <p className="mt-1.5 text-xs text-muted-foreground">
        Enter the full 10-digit number for an exact match.
      </p>
    );
  } else if (lookupReady && isFetching) {
    status = <p className="mt-1.5 text-xs text-muted-foreground">Looking up…</p>;
  } else if (lookupReady && found && trimmedPhone !== appliedPhone) {
    status = (
      <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-sm font-medium text-foreground">{found.name}</p>
        {found.email ? <p className="text-xs text-muted-foreground">{found.email}</p> : null}
        {found.address ? <p className="text-xs text-muted-foreground">{found.address}</p> : null}
        <Button type="button" size="md" className="mt-2 h-9 px-3 text-xs" onClick={applyFound}>
          Use this customer
        </Button>
      </div>
    );
  } else if (lookupReady && found === null) {
    status = (
      <p className="mt-1.5 text-xs text-muted-foreground">
        No customer found with this number. Enter details manually.
      </p>
    );
  }

  return (
    <div className="panel p-5">
      <h3 className="font-display text-xl text-foreground">Customer</h3>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <Label htmlFor="standalone-customer-phone">Phone</Label>
          <Input
            id="standalone-customer-phone"
            value={customer.phone}
            // Digits only, capped at 10 - matches PHONE_PATTERN above (the
            // lookup feature already only fires on exactly 10 digits), so
            // typing can never produce something the schema would reject
            // at save time anyway.
            onChange={(e) =>
              setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
            }
            placeholder="9812345678"
            className={fieldErrors["customer.phone"] ? "border-destructive focus-visible:ring-destructive" : undefined}
          />
          {fieldErrors["customer.phone"] ? (
            <p className="mt-1.5 text-xs text-destructive">{fieldErrors["customer.phone"]}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="standalone-customer-name">Name</Label>
          <Input
            id="standalone-customer-name"
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            className={fieldErrors["customer.name"] ? "border-destructive focus-visible:ring-destructive" : undefined}
          />
          {fieldErrors["customer.name"] ? (
            <p className="mt-1.5 text-xs text-destructive">{fieldErrors["customer.name"]}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="standalone-customer-email">Email</Label>
          <Input
            id="standalone-customer-email"
            type="email"
            value={customer.email ?? ""}
            onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            className={fieldErrors["customer.email"] ? "border-destructive focus-visible:ring-destructive" : undefined}
          />
          {fieldErrors["customer.email"] ? (
            <p className="mt-1.5 text-xs text-destructive">{fieldErrors["customer.email"]}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="standalone-customer-address">Address</Label>
          <Input
            id="standalone-customer-address"
            value={customer.address ?? ""}
            onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
          />
        </div>
      </div>

      {!fieldErrors["customer.phone"] && status ? <div className="mt-3">{status}</div> : null}
    </div>
  );
}
