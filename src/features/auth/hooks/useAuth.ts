import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { setStoredToken } from "@/lib/auth-token";
import { useAuthStore, type AuthUser } from "@/store/useAuthStore";
import type { LoginInput } from "@/schemas/auth.schema";

interface LoginResponse {
  user: AuthUser;
  token: string;
}

export function useLogin() {
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: (input: LoginInput) => apiClient.post<LoginResponse>("/auth/login", input),
    onSuccess: (data) => {
      setStoredToken(data.token);
      setUser(data.user);
    },
  });
}
