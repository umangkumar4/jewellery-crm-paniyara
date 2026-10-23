"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Award, Diamond, Shield } from "lucide-react";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { getStoredToken } from "@/lib/auth-token";
import { shopConfig } from "@/lib/shop-config";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (getStoredToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="paper-texture flex min-h-screen items-center justify-center bg-background p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-card shadow-2xl md:grid-cols-2">
        <div className="ink-panel relative flex flex-col justify-between p-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold text-gold-foreground">
                <Diamond className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-gold uppercase">
                  {shopConfig.portalName}
                </p>
                <p className="text-xs text-sidebar-foreground/60">{shopConfig.portalTagline}</p>
              </div>
            </div>

            <h1 className="font-display mt-10 text-4xl text-gold">{shopConfig.legalNameHi}</h1>
            <p className="font-display mt-2 text-2xl text-sidebar-foreground/90">
              {shopConfig.legalNameHiSub}
            </p>

            <p className="font-display mt-8 text-lg italic text-sidebar-foreground/90">
              {shopConfig.legalNameEn}
            </p>
            <p className="mt-4 max-w-sm text-sm text-sidebar-foreground/70">{shopConfig.tagline}</p>

            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-sidebar-border/60 bg-white/5 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-gold">
                  <Shield className="h-4 w-4" />
                </span>
                <span className="text-sm text-sidebar-foreground">100% BIS Hallmarked Jewellery Portal</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-sidebar-border/60 bg-white/5 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-gold">
                  <Award className="h-4 w-4" />
                </span>
                <span className="text-sm text-sidebar-foreground">
                  Trusted Excellence Since {shopConfig.since}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="gold-rule mb-4 opacity-40" />
            <div className="flex items-center justify-between">
              <span className="rounded bg-black/20 px-3 py-1 font-mono text-xs text-gold">
                GSTIN: {shopConfig.gstin}
              </span>
              <span className="text-xs text-sidebar-foreground/50">{shopConfig.version}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center p-10">
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">Welcome Back</p>
          <h2 className="font-display mt-1 text-4xl text-foreground">Login</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your credentials to access the billing dashboard
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>

          <p className="mt-10 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} {shopConfig.legalNameEn}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
