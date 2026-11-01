import Link from "next/link";
import { Receipt, Tag } from "lucide-react";
import { shopConfig } from "@/lib/shop-config";

// Plain <Link>s styled to match Button.tsx's gold/outline variants, not the
// Button component itself - Button is a native <button> wrapper with no
// asChild support, so it can't render as a navigable <a>. "Create Tag"'s
// outline is overridden for this dark ink-panel context the same way the
// login page's own badges are (border-sidebar-border/60 + bg-white/5),
// since Button's default outline colors assume a light panel.
export function DashboardWelcomeBanner() {
  return (
    <div className="ink-panel flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Welcome Back</p>
        <h1 className="font-display mt-1 text-2xl text-sidebar-foreground sm:text-3xl">
          {shopConfig.legalNameHi} {shopConfig.legalNameHiSub}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/billing"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gold px-5 text-sm font-semibold tracking-wide text-gold-foreground shadow-[var(--shadow-gold)] transition hover:brightness-105 active:brightness-95"
        >
          <Receipt className="h-4 w-4" />
          New Bill
        </Link>
        <Link
          href="/tagging"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-sidebar-border/60 bg-white/5 px-5 text-sm font-semibold tracking-wide text-sidebar-foreground transition hover:bg-white/10"
        >
          <Tag className="h-4 w-4" />
          Create Tag
        </Link>
      </div>
    </div>
  );
}
