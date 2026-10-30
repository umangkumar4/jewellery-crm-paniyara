"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  Gem,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { shopConfig } from "@/lib/shop-config";
import { useAuthStore } from "@/store/useAuthStore";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const modules: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Billing", href: "/billing", icon: Receipt },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Tags", href: "/tagging", icon: Tag },
  // { label: "Old Jewellery", href: "/old-inventory", icon: Gem },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 print:hidden",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <img
          src="/logo.png"
          alt={shopConfig.heritageLineEn}
          className="h-9 w-9 shrink-0 rounded-full bg-white object-contain p-1"
        />
        {!collapsed ? (
          <div className="min-w-0">
            <p className=" truncate text-sm leading-tight">Shri Khaduram Jewellers</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {modules.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-sidebar-border/60 px-5 py-4">
        {!collapsed ? (
          <p className="font-mono text-[11px] text-sidebar-foreground/50">GSTIN: {shopConfig.gstin}</p>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Logout"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            collapsed ? "justify-center" : "-mx-3 w-[calc(100%+1.5rem)]",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed ? <span className="truncate">Logout</span> : null}
        </button>
      </div>
    </aside>
  );
}
