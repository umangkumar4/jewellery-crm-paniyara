import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ChangePasswordInput } from "@/schemas/auth.schema";

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiClient.post<{ success: true }>("/auth/change-password", input),
  });
}
