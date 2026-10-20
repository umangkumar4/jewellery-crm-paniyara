"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, LogOut, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { shopConfig } from "@/lib/shop-config";
import { useAuthStore } from "@/store/useAuthStore";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/billing": "Billing",
  "/tagging": "Tags",
};

export function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const title = pageTitles[pathname ?? ""] ?? "";

  function handleLogout() {
    setMenuOpen(false);
    logout();
    router.replace("/login");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-display text-lg text-foreground">{title}</h1>
      </div>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <span>{shopConfig.legalNameEn}</span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {menuOpen ? (
          <div className="absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
