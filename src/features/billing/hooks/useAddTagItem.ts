import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";
import type { MetalPurity } from "@/features/settings/hooks/useMetalPurities";
import { useBillingStore } from "@/store/useBillingStore";

// GET /api/tags/:code (serializeTag()) never returns a rate - rates live on
// the separate MetalPurity catalog. A second lookup is unavoidable to
// prefill rate_per_gram for a scanned/browsed item.
//
// GET /api/purities returns {data: [...]}, same envelope as every other
// list endpoint in this app (GET /api/tags, GET /api/invoices) - NOT a bare
// array. Reusing useMetalPurities.ts's own MetalPurity type here (instead
// of a second, slightly different local shape) so this can't silently
// drift out of sync with the real response again.
async function fetchCurrentRate(metal: string, purity: string): Promise<number> {
  // includeInactive=true - a tag's purity can have been archived in
  // Settings since the tag itself was created, but the tag is still a real
  // physical item with a real last-known rate. Without this, GET
  // /api/purities defaults to active-only, so an archived purity's rate
  // would silently resolve to 0 instead of its actual value.
  const { data } = await apiClient.get<{ data: MetalPurity[] }>(
    `/purities?metal=${encodeURIComponent(metal)}&includeInactive=true`,
  );
  return data.find((p) => p.purity === purity)?.rate_per_gram ?? 0;
}

// Shared by ScanInput ("Enter Code") and TagBrowseDialog ("Browse Tags") -
// both ultimately add a tag-linked item the same way, including always
// re-fetching the exact tag by code rather than trusting a cached list row
// (see docs/billing-plan.md decision 11).
export function useAddTagItem() {
  const addItem = useBillingStore((state) => state.addItem);
  const hasTag = useBillingStore((state) => state.hasTag);

  return useMutation({
    mutationFn: async (code: string) => {
      if (hasTag(code)) {
        throw new Error("This tag is already in the current sale.");
      }

      const tag = await apiClient.get<Tag>(`/tags/${encodeURIComponent(code)}`);
      const ratePerGram = await fetchCurrentRate(tag.metal, tag.purity);

      addItem({
        tagCode: tag.code,
        description: tag.product_name,
        hsnCode: "7113",
        metal: tag.metal,
        purity: tag.purity,
        pieces: 1,
        grossWtG: tag.gross_wt_g,
        stoneWtG: tag.stone_wt_g,
        netWtG: tag.net_wt_g,
        ratePerGram,
        makingCharge: 0,
        makingMethod: "fixed",
        makingValue: 0,
        stoneCharge: tag.stone_amount,
        buyerCode: tag.buyer_code,
      });

      return tag;
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Could not add this tag.");
    },
  });
}
