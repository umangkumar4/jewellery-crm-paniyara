"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    // h-screen/overflow-hidden/overflow-y-auto make the sidebar layout work
    // on screen (content scrolls, sidebar stays put), but at print time
    // they clip `main` to one screen's height - anything below the fold
    // (e.g. the Old Jewellery Exchange table + Totals on a longer invoice)
    // never reaches the printed page. Sidebar/Header already go
    // print:hidden; this just lets `main` grow to its full content height
    // for print instead of staying capped at the on-screen viewport.
    <div className="flex h-screen overflow-hidden bg-background print:h-auto print:overflow-visible">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onToggleSidebar={() => setCollapsed((v) => !v)} onOpenMobileSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  );
}
