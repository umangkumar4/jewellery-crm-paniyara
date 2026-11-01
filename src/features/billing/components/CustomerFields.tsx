"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useCustomerLookup } from "@/features/billing/hooks/useCustomerLookup";
import { useBillingStore } from "@/store/useBillingStore";

const PHONE_PATTERN = /^\d{10}$/;

export function CustomerFields() {
  const customer = useBillingStore((state) => state.customer);
  const setCustomer = useBillingStore((state) => state.setCustomer);
  const fieldErrors = useBillingStore((state) => state.fieldErrors);

  const trimmedPhone = customer.phone.trim();
  const isCompletePhone = PHONE_PATTERN.test(trimmedPhone);

  const [debouncedPhone, setDebouncedPhone] = useState("");
  // The phone a "Use this customer" click was last applied for - suppresses
  // re-showing the same confirmation card after it's already been used,
  // without needing to track anything beyond this one value.
  const [appliedPhone, setAppliedPhone] = useState<string | null>(null);

  // Resets debouncedPhone to "" the instant the number becomes incomplete -
  // derived during render (same pattern as ItemTable.tsx's purity/weight
  // sync), not a synchronous setState call inside an effect body.
  const [prevCompletePhone, setPrevCompletePhone] = useState(isCompletePhone);
  if (prevCompletePhone !== isCompletePhone) {
    setPrevCompletePhone(isCompletePhone);
    if (!isCompletePhone) {
      setDebouncedPhone("");
    }
  }

  // Only ever debounces toward firing a lookup once the number is a
  // complete 10 digits - the backend is an exact match, not a prefix
  // search, so there's nothing useful to look up before then.
  useEffect(() => {
    if (!isCompletePhone) return;
    const timer = setTimeout(() => setDebouncedPhone(trimmedPhone), 300);
    return () => clearTimeout(timer);
  }, [trimmedPhone, isCompletePhone]);

  const { data: found, isFetching } = useCustomerLookup(debouncedPhone);
  // "ready" means the debounced phone we last searched for still matches
  // what's actually in the field right now - guards against showing a
  // found/not-found result left over from a number the cashier has since
  // changed, while the new debounce is still in flight.
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

      {/* Single row on desktop (Phone/Name/Email/Address side by side) -
          the phone lookup's status text/found-card renders full-width
          below the row, not squeezed under just the Phone field, since a
          found-customer card is too tall to fit inside a quarter-width
          column. */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <Label htmlFor="customer-phone">Phone</Label>
          <Input
            id="customer-phone"
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
          <Label htmlFor="customer-name">Name</Label>
          <Input
            id="customer-name"
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            className={fieldErrors["customer.name"] ? "border-destructive focus-visible:ring-destructive" : undefined}
          />
          {fieldErrors["customer.name"] ? (
            <p className="mt-1.5 text-xs text-destructive">{fieldErrors["customer.name"]}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="customer-email">Email</Label>
          <Input
            id="customer-email"
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
          <Label htmlFor="customer-address">Address</Label>
          <Input
            id="customer-address"
            value={customer.address ?? ""}
            onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
          />
        </div>
      </div>

      {!fieldErrors["customer.phone"] && status ? <div className="mt-3">{status}</div> : null}
    </div>
  );
}
