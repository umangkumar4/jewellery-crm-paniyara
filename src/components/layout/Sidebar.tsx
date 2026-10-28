"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Gem,
  LayoutDashboard,
  Receipt,
  Settings,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { shopConfig } from "@/lib/shop-config";

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
          alt={shopConfig.appName}
          className="h-9 w-9 shrink-0 rounded-full bg-gold/20 object-contain p-1"
        />
        {!collapsed ? (
          <div className="min-w-0">
            <p className="font-display truncate text-lg leading-tight">{shopConfig.appName}</p>
            <p className="truncate text-[10px] tracking-wide text-sidebar-foreground/50 uppercase">
              {shopConfig.appTagline}
            </p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {!collapsed ? (
          <p className="px-3 pb-2 text-[11px] tracking-wide text-sidebar-foreground/50 uppercase">
            Modules
          </p>
        ) : null}
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

      <div className="border-t border-sidebar-border/60 px-5 py-4">
        {!collapsed ? (
          <p className="font-mono text-[11px] text-sidebar-foreground/50">GSTIN: {shopConfig.gstin}</p>
        ) : null}
      </div>
    </aside>
  );
}
