"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Diamond,
  FileText,
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
  { label: "Tags", href: "/tagging", icon: Tag },
  { label: "Settings", href: "/settings", icon: Settings },
];

const comingSoon: NavItem[] = [
  { label: "Inventory", href: "#", icon: Boxes },
  { label: "Customers", href: "#", icon: Users },
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
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold">
          <Diamond className="h-5 w-5" />
        </div>
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

        {!collapsed ? (
          <p className="px-3 pt-6 pb-2 text-[11px] tracking-wide text-sidebar-foreground/50 uppercase">
            Coming soon
          </p>
        ) : (
          <div className="mt-6 border-t border-sidebar-border/60 pt-6" />
        )}
        <ul className="space-y-1">
          {comingSoon.map((item) => (
            <li key={item.label}>
              <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/40 opacity-50">
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </span>
            </li>
          ))}
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
