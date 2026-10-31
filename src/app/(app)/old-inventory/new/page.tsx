"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api-client";
import { StandaloneCustomerFields } from "@/features/dashboard/components/StandaloneCustomerFields";
import { StandaloneItemsSection } from "@/features/dashboard/components/StandaloneItemsSection";
import { StandaloneRefundSection } from "@/features/dashboard/components/StandaloneRefundSection";
import { isOldJewelleryItemValid } from "@/features/billing/lib/itemValidity";
import { useCreateOldPurchase } from "@/features/dashboard/hooks/useCreateOldPurchase";
import { useOldPurchaseStore, type OldPurchaseFieldErrors } from "@/store/useOldPurchaseStore";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  createStandaloneOldJewelleryPurchaseSchema,
  type CreateStandaloneOldJewelleryPurchaseInput,
} from "@/schemas/standaloneOldJewelleryPurchase.schema";

// Same "pre-validate client-side with the exact server schema, so the UI
// can point at the precise field/row" pattern as billing/page.tsx's
// collectValidationErrors - the server's 422 body only ever flattens to one
// message per top-level field.
function collectValidationErrors(body: unknown): {
  fieldErrors: OldPurchaseFieldErrors;
  itemErrors: Record<number, Record<string, string>>;
} {
  const result = createStandaloneOldJewelleryPurchaseSchema.safeParse(body);
  const fieldErrors: OldPurchaseFieldErrors = {};
  const itemErrors: Record<number, Record<string, string>> = {};

  if (!result.success) {
    for (const issue of result.error.issues) {
      const [first, second, third] = issue.path;
      if (first === "items" && typeof second === "number") {
        const field = String(third ?? "_item");
        itemErrors[second] = { ...itemErrors[second], [field]: issue.message };
      } else {
        fieldErrors[issue.path.join(".")] = issue.message;
      }
    }
  }

  return { fieldErrors, itemErrors };
}

export default function NewOldPurchasePage() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<{ id: string; no: string } | null>(null);
  // Idempotency key, same role as billing/page.tsx's operationId - stable
  // across repeated "Record Purchase" clicks/retries on the same draft,
  // regenerated explicitly on "New Purchase" below.
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());

  const customer = useOldPurchaseStore((state) => state.customer);
  const items = useOldPurchaseStore((state) => state.items);
  const refund = useOldPurchaseStore((state) => state.refund);
  const setFieldErrors = useOldPurchaseStore((state) => state.setFieldErrors);
  const reset = useOldPurchaseStore((state) => state.reset);

  const createOldPurchase = useCreateOldPurchase();

  const totalValue = Math.round(items.reduce((sum, item) => sum + item.finalValue, 0));
  const isRefundComplete = refund.mode !== null && refund.confirmed;

  const canSave =
    customer.name.trim().length > 0 &&
    customer.phone.trim().length > 0 &&
    items.length > 0 &&
    items.every(isOldJewelleryItemValid) &&
    isRefundComplete &&
    !createOldPurchase.isPending;

  const handleSave = () => {
    const body: CreateStandaloneOldJewelleryPurchaseInput = {
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email?.trim() || undefined,
        address: customer.address?.trim() || undefined,
      },
      items: items.map((item) => ({
        description: item.description,
        metal: item.metal,
        purity: item.purity,
        gross_wt_g: item.grossWtG,
        stone_wt_g: item.stoneWtG,
        dust_wt_g: item.dustWtG,
        other_deduction_wt_g: item.otherDeductionWtG,
        net_wt_g: item.netWtG,
        default_rate_per_gram: item.defaultRatePerGram,
        applied_rate_per_gram: item.appliedRatePerGram,
        calculated_value: item.calculatedValue,
        final_value: item.finalValue,
        override_reason: item.overrideReason || undefined,
      })),
      refund: {
        amount: totalValue,
        mode: refund.mode!,
        reference: refund.reference || undefined,
        remarks: refund.remarks || undefined,
      },
      operation_id: operationId,
    };

    const { fieldErrors: nextFieldErrors, itemErrors: nextItemErrors } = collectValidationErrors(body);
    if (Object.keys(nextFieldErrors).length > 0 || Object.keys(nextItemErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      toast.error("Please fix the highlighted fields before recording this purchase.");
      return;
    }

    createOldPurchase.mutate(body, {
      onSuccess: (result) => {
        setConfirmation({ id: result.id, no: result.purchase_no });
        reset();
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          if (error.fields) {
            toast.error(Object.values(error.fields).join(" · "));
            return;
          }
          toast.error(error.message);
          return;
        }
        toast.error("Something went wrong. Please try again.");
      },
    });
  };

  if (confirmation) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="panel p-8">
          <h2 className="font-display text-2xl text-foreground">Purchase Recorded</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Purchase <span className="gold-text font-semibold">{confirmation.no}</span> created.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={() => router.push(`/old-purchases/${confirmation.id}/print`)}
            >
              Print Receipt
            </Button>
            <Button
              onClick={() => {
                setConfirmation(null);
                setOperationId(crypto.randomUUID());
              }}
            >
              New Purchase
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="New Old Jewellery Purchase"
        description="Buy old jewellery from a customer with no linked sale - the full value is paid out."
      />

      <div className="mt-6 space-y-4">
        <StandaloneCustomerFields />
        <StandaloneItemsSection />
        <StandaloneRefundSection />

        <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-muted-foreground">
            Total <span className="font-medium text-foreground">₹{totalValue.toLocaleString("en-IN")}</span>
          </p>
          <Button disabled={!canSave} onClick={handleSave}>
            {createOldPurchase.isPending ? "Recording…" : "Record Purchase"}
          </Button>
        </div>
      </div>
    </div>
  );
}
