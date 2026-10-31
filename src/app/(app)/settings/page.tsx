"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetalRateForm } from "@/features/settings/components/MetalRateForm";
import { MetalRatesTable } from "@/features/settings/components/MetalRatesTable";
import { AddPurityForm } from "@/features/settings/components/AddPurityForm";
import { PurityList } from "@/features/settings/components/PurityList";
import { PageHeader } from "@/components/layout/PageHeader";

type SettingsTab = "rates" | "purities";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("rates");

  return (
    <div className="mx-auto max-w-full">
      <PageHeader title="Settings" description="Manage purities and today&apos;s metal rates." />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)} className="mt-6">
        <TabsList variant="line">
          <TabsTrigger variant="line" value="rates">
            Set Metal Rate
          </TabsTrigger>
          <TabsTrigger variant="line" value="purities">
            Add Purity
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "rates" ? (
        <div className="mt-6">
          <div className="panel p-6">
            <MetalRateForm />
          </div>
          <MetalRatesTable />
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
