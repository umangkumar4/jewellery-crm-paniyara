"use client";

import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center bg-background px-6 print:hidden">
      <Button type="button" variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <PanelLeft className="h-4 w-4" />
      </Button>
    </header>
  );
}
