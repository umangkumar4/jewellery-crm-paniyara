import { create } from "zustand";
import { calculateOldJewelleryItemValuation } from "@/features/billing/lib/calculations";
// Type-only imports - no runtime dependency on useBillingStore. These shapes
// are generic to "an old jewellery item being entered/valued" and "a manual
// payout draft," not specific to the billing flow they happen to also be
// used by, so they're reused rather than redefined here.
import type { BillingCustomer, OldJewelleryDraftItem, OldJewelleryRefundDraft, RefundMode } from "@/store/useBillingStore";

export type { OldJewelleryDraftItem, OldJewelleryRefundDraft, RefundMode };

const EMPTY_CUSTOMER: BillingCustomer = { name: "", phone: "", email: "", address: "" };
const EMPTY_REFUND: OldJewelleryRefundDraft = { mode: null, reference: "", remarks: "", confirmed: false };

export type OldPurchaseFieldErrors = Record<string, string>;

interface OldPurchaseState {
  customer: BillingCustomer;
  items: OldJewelleryDraftItem[];
  refund: OldJewelleryRefundDraft;
  fieldErrors: OldPurchaseFieldErrors;

  setCustomer: (customer: BillingCustomer) => void;
  addItem: (item: Omit<OldJewelleryDraftItem, "id" | "netWtG" | "calculatedValue">) => void;
  updateItem: (id: string, patch: Partial<Omit<OldJewelleryDraftItem, "id">>) => void;
  removeItem: (id: string) => void;
  updateRefund: (patch: Partial<OldJewelleryRefundDraft>) => void;
  setFieldErrors: (fieldErrors: OldPurchaseFieldErrors) => void;
  reset: () => void;
}

// Same auto-derive rule as useBillingStore's withValuation - netWtG/
// calculatedValue are always computed here, never trusted from the caller.
function withValuation(item: Omit<OldJewelleryDraftItem, "netWtG" | "calculatedValue">): OldJewelleryDraftItem {
  const { netWtG, calculatedValue } = calculateOldJewelleryItemValuation({
    grossWtG: item.grossWtG,
    stoneWtG: item.stoneWtG,
    dustWtG: item.dustWtG,
    otherDeductionWtG: item.otherDeductionWtG,
    ratePerGram: item.appliedRatePerGram,
  });
  return { ...item, netWtG, calculatedValue };
}

const NO_ERRORS = { fieldErrors: {} };

// Fully independent from useBillingStore - the standalone Old Jewellery
// Purchase page (sell-without-buy) has no GST, discount, payment, or new-
// jewellery-item concepts, so it gets its own minimal store rather than a
// "mode" flag bolted onto the billing store. See
// docs/old-jewellery-exchange-plan.md's standalone-purchase phase.
export const useOldPurchaseStore = create<OldPurchaseState>((set) => ({
  customer: EMPTY_CUSTOMER,
  items: [],
  refund: EMPTY_REFUND,
  fieldErrors: {},

  setCustomer: (customer) => set({ customer, ...NO_ERRORS }),

  addItem: (item) =>
    set((state) => ({
      items: [...state.items, withValuation({ ...item, id: crypto.randomUUID() })],
      ...NO_ERRORS,
    })),

  updateItem: (id, patch) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? withValuation({ ...item, ...patch }) : item)),
      ...NO_ERRORS,
    })),

  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id), ...NO_ERRORS })),

  updateRefund: (patch) => set((state) => ({ refund: { ...state.refund, ...patch } })),

  setFieldErrors: (fieldErrors) => set({ fieldErrors }),

  reset: () => set({ customer: EMPTY_CUSTOMER, items: [], refund: EMPTY_REFUND, ...NO_ERRORS }),
}));
