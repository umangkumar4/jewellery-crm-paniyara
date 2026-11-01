"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import {
  FileText,
  Gem,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  Tag,
  User as UserIcon,
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

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <>
      {/* Backdrop - only reachable below lg, where the sidebar is an
          overlay drawer instead of a permanent flex column. */}
      <div
        onClick={onCloseMobile}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0 lg:transition-[width] print:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-20" : "lg:w-64",
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
                  onClick={onCloseMobile}
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
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                collapsed ? "justify-center" : "-mx-3 w-[calc(100%+1.5rem)]",
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-semibold text-gold">
                {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-3.5 w-3.5" />}
              </span>
              {!collapsed ? <span className="truncate">{user?.name ?? "Account"}</span> : null}
            </button>
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              side="top"
              align="start"
              sideOffset={8}
              className="panel z-50 min-w-40 p-1"
            >
              <DropdownMenuPrimitive.Item asChild>
                <Link
                  href="/profile"
                  onClick={onCloseMobile}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground outline-none hover:bg-muted"
                >
                  <UserIcon className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuPrimitive.Item>
              <DropdownMenuPrimitive.Item
                onSelect={handleLogout}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground outline-none hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuPrimitive.Item>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
      </div>
      </aside>
    </>
  );
}
