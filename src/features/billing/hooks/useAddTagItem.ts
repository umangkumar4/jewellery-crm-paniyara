import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";
import { useBillingStore } from "@/store/useBillingStore";

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
        ratePerGram: tag.rate_per_gram ?? 0,
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
        // 409 here only ever means "this tag is already sold" (see GET
        // /api/tags/[code]) - ScanInput shows a dedicated popup for that
        // case instead of this generic toast. TagBrowseDialog, the only
        // other caller, can never hit it: its list is pre-filtered to
        // status "tagged", so a sold tag is never clickable there.
        if (error.status === 409) return;
        toast.error(error.message);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Could not add this tag.");
    },
  });
}
