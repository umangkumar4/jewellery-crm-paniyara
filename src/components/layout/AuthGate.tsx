"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken } from "@/lib/auth-token";
import { Loader } from "@/components/ui/Loader";

/**
 * There's no cookie, so the server has no idea who's logged in on a plain
 * navigation (see docs/PROGRESS.md decision #8) - this client-side check
 * after mount is the only place that can gate a protected route.
 *
 * Reads the token directly in the effect (post-mount) rather than via a
 * useSyncExternalStore hook with a fake `false` server snapshot: that fake
 * value was getting treated as "logged out" by this effect on every refresh,
 * firing a real redirect to /login before the real token value was read.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (getStoredToken()) {
      setAuthed(true);
    } else {
      router.replace("/login");
    }
  }, [router]);

  if (!authed) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
