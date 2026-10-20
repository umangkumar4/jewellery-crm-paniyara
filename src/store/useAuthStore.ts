import { create } from "zustand";
import { clearStoredToken } from "@/lib/auth-token";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => {
    clearStoredToken();
    set({ user: null });
  },
}));
