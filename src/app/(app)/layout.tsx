import type { ReactNode } from "react";
import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate> 
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
