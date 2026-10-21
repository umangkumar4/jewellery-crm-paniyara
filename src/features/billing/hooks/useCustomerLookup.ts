import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";

export interface CustomerLookupResult {
  id: string;
  name: string;
  email?: string;
  address?: string;
}

// A 404 here means "first-time walk-in" - REQUIREMENTS.md calls this out
// explicitly as an expected outcome, not an error. Swallowing it into
// `data: null` means callers just check for a customer, with no separate
// error-state branch for the single most common case (a new customer).
//
// Only fires on a complete 10-digit number - the backend does an exact
// phone match, not a prefix search, so calling it on a partial number
// would only ever burn a request to get a 404 for an incomplete number
// that was never going to match anything. CustomerFields.tsx is the only
// caller; this `enabled` gate is kept here (not just there) as the single
// source of truth for "when is a lookup actually worth firing."
export function useCustomerLookup(phone: string) {
  return useQuery({
    queryKey: ["customer-lookup", phone],
    queryFn: async (): Promise<CustomerLookupResult | null> => {
      try {
        return await apiClient.get<CustomerLookupResult>(`/customers?phone=${encodeURIComponent(phone)}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: /^\d{10}$/.test(phone.trim()),
    retry: false,
  });
}
