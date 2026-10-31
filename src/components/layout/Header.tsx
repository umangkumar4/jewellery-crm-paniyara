"use client";

import { Menu, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function Header({
  onToggleSidebar,
  onOpenMobileSidebar,
}: {
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-1 bg-background px-6 print:hidden">
      {/* Opens the sidebar as a mobile drawer - the desktop collapse
          toggle below is hidden at this breakpoint since the sidebar is
          an overlay here, not a permanent column to collapse/expand. */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onOpenMobileSidebar}
        aria-label="Open menu"
        className="lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        className="hidden lg:inline-flex"
      >
        <PanelLeft className="h-4 w-4" />
      </Button>
    </header>
  );
}
