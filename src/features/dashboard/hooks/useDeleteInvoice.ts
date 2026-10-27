import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface DeleteInvoiceResult {
  message: string;
  reverted_tags: string[];
}

export function useDeleteInvoice(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) =>
      apiClient.delete<DeleteInvoiceResult>(`/invoices/${invoiceId}`, { reason }),
    onSuccess: () => {
      // Partial-key invalidation, same convention every other mutation in
      // this app uses - catches every filtered/ranged variant of each query
      // (dashboard-summary's range param, sales-trend's range param) rather
      // than needing to know every variant currently cached.
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["sales-trend"] });
    },
  });
}
