"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MetalRateForm } from "@/features/settings/components/MetalRateForm";
import { MetalRatesTable } from "@/features/settings/components/MetalRatesTable";
import { AddPurityForm } from "@/features/settings/components/AddPurityForm";
import { PurityList } from "@/features/settings/components/PurityList";
import type { MetalPurity } from "@/features/settings/hooks/useMetalPurities";

type SettingsTab = "rates" | "purities";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("rates");
  const [editingPurity, setEditingPurity] = useState<MetalPurity | null>(null);

  return (
    <div className="mx-auto max-w-full">
      <h2 className="font-display text-2xl text-foreground">Settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">Manage purities and today&apos;s metal rates.</p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("rates")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "rates"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Set Metal Rate
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("purities")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "purities"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Add Purity
        </button>
      </div>

      {activeTab === "rates" ? (
        <div className="mt-6">
          <div className="panel p-6">
            <MetalRateForm editingPurity={editingPurity} onSaved={() => setEditingPurity(null)} />
          </div>
          <MetalRatesTable onEdit={setEditingPurity} />
        </div>
      ) : (
        <div className="mt-6">
          <div className="panel p-6">
            <AddPurityForm />
          </div>
          <PurityList />
        </div>
      )}
    </div>
  );
}
