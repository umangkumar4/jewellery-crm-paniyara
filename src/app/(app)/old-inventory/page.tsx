import { OldJewelleryInventoryGrid } from "@/features/dashboard/components/OldJewelleryInventoryGrid";
import { PageHeader } from "@/components/layout/PageHeader";

export default function OldInventoryPage() {
  return (
    <div className="mx-auto max-w-full">
      <PageHeader
        title="Old Jewellery"
        description="Items taken in through exchange - mark them Disposed or Melted once they leave the shop."
      />

      <div className="mt-6">
        <OldJewelleryInventoryGrid />
      </div>
    </div>
  );
}
