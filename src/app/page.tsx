"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHasStoredToken } from "@/lib/use-has-token";

export default function Home() {
  const router = useRouter();
  const hasToken = useHasStoredToken();

  useEffect(() => {
    router.replace(hasToken ? "/dashboard" : "/login");
  }, [hasToken, router]);

  return null;
}
