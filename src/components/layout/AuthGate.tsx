"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useHasStoredToken } from "@/lib/use-has-token";

/**
 * There's no cookie, so the server has no idea who's logged in on a plain
 * navigation (see docs/PROGRESS.md decision #8) - this client-side check
 * after mount is the only place that can gate a protected route.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hasToken = useHasStoredToken();

  useEffect(() => {
    if (!hasToken) {
      router.replace("/login");
    }
  }, [hasToken, router]);

  if (!hasToken) return null;

  return <>{children}</>;
}
