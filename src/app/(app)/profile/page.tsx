"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { ChangePasswordForm } from "@/features/settings/components/ChangePasswordForm";
import { shopConfig } from "@/lib/shop-config";
import { useAuthStore } from "@/store/useAuthStore";

// user is only populated by useLogin()'s onSuccess (useAuthStore has no
// persist middleware) - a hard refresh resets it to null even though the
// stored token still keeps AuthGate happy, so every field here falls back
// to "—" rather than assuming it's always set. Pre-existing store
// behavior, not something this page changes.
export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Profile" description="Your account and shop details." />
      <div className="panel p-6">
        <h3 className="font-display text-lg text-foreground">Shop Details</h3>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Shop Name</dt>
            <dd className="text-sm text-foreground">{shopConfig.legalNameEn}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">GSTIN</dt>
            <dd className="text-sm text-foreground">{shopConfig.gstin}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Address</dt>
            <dd className="text-sm text-foreground">{shopConfig.addressEn}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd className="text-sm text-foreground">{shopConfig.phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Established</dt>
            <dd className="text-sm text-foreground">{shopConfig.since}</dd>
          </div>
        </dl>
      </div>

      <div className="panel p-6">
        <h3 className="font-display text-lg text-foreground">Security</h3>
        <p className="mt-1 text-sm text-muted-foreground">Change your account password.</p>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
