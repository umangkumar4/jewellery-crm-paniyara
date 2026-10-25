import { OldJewelleryInventoryGrid } from "@/features/dashboard/components/OldJewelleryInventoryGrid";

export default function OldInventoryPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="font-display text-2xl text-foreground">Old Jewellery</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Items taken in through exchange - mark them Disposed or Melted once they leave the shop.
      </p>

      <div className="mt-6">
        <OldJewelleryInventoryGrid />
      </div>
    </div>
  );
}
