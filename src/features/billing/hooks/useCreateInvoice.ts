import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CreateInvoiceInput } from "@/schemas/invoice.schema";

export interface CreateInvoiceResult {
  invoice_id: string;
  invoice_no: string;
  created_at: string;
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => apiClient.post<CreateInvoiceResult>("/invoices", input),
    onSuccess: () => {
      // A successful sale marks tags sold and creates/updates the customer
      // and invoice ledger - every list that could now be stale needs to refresh.
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
