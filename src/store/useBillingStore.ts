import { create } from "zustand";
import { calculateItemTotal, calculateOldJewelleryItemValuation, type MakingMethod } from "@/features/billing/lib/calculations";
import { METALS } from "@/lib/metals";

export interface BillingCustomer {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface BillingItem {
  // Client-only identity, never sent to the server (billing/page.tsx maps
  // each item to the API payload field-by-field, not via spread, so this
  // never leaks into the request body). Exists purely so the billing
  // grid's cell renderers can be matched to the correct row across an
  // edit - see the long comment on ItemTable.tsx's AgGridReact `getRowId`
  // for why this is load-bearing, not decorative.
  id: string;
  tagCode?: string | null;
  description: string;
  hsnCode: string;
  metal: string;
  purity: string;
  pieces: number;
  grossWtG: number;
  stoneWtG: number;
  netWtG: number;
  ratePerGram: number;
  // makingCharge is always the derived ₹ result - never typed directly
  // anymore (see MakingChargeDialog.tsx). makingMethod/makingValue record
  // what actually produced it: the flat ₹, the ₹/g rate, or the % of metal
  // value the admin chose, so reopening the dialog can pre-fill the real
  // inputs instead of guessing a method from the number alone.
  makingCharge: number;
  makingMethod: MakingMethod;
  makingValue: number;
  stoneCharge: number;
  total: number;
}

// A customer's old jewellery exchanged during this sale - settlement
// against the bill (exchange-first, see docs/old-jewellery-exchange-plan.md),
// never a discount on the new items above. Client-only draft shape, same
// id/never-sent-raw convention as BillingItem.
export interface OldJewelleryDraftItem {
  id: string;
  description: string;
  metal: string;
  purity: string;
  grossWtG: number;
  stoneWtG: number;
  dustWtG: number;
  otherDeductionWtG: number;
  // Auto-derived only (Decision 15) - never typed directly, always
  // max(0, gross - stone - dust - other), recomputed by withValuation below.
  netWtG: number;
  // Snapshot of MetalPurity.purchaseRatePerGram at the moment this purity
  // was picked - null if that purity has no default purchase rate
  // configured yet, in which case the admin types appliedRatePerGram by hand.
  defaultRatePerGram: number | null;
  appliedRatePerGram: number;
  calculatedValue: number;
  // Defaults to calculatedValue and re-syncs to it whenever a weight/rate
  // field changes (same "auto-derive but still directly editable, overwritten
  // again on the next relevant change" convention net weight itself already
  // uses) - but is a fully independent, directly editable field in between.
  finalValue: number;
  overrideReason: string;
}

export type BillingPaymentMode = "cash" | "upi" | "card" | "bank_transfer";

export interface BillingPayment {
  amount: number;
  mode: BillingPaymentMode;
}

const EMPTY_CUSTOMER: BillingCustomer = { name: "", phone: "", email: "", address: "" };

// Keyed by dot-joined Zod issue path for anything outside items[] -
// "customer.phone", "paid_amount", "items" (a whole-array issue like a
// duplicate tag_code, not tied to one row), etc. Built from the raw
// ZodError in billing/page.tsx (createInvoiceSchema.safeParse()), not from
// the server's flattened 422 body - the server's flattenError() collapses
// everything to one message per top-level field (e.g. just "customer"),
// losing exactly which sub-field or which item index failed.
export type BillingFieldErrors = Record<string, string>;
export type BillingItemErrors = Record<number, Record<string, string>>;

interface BillingState {
  customer: BillingCustomer;
  items: BillingItem[];
  oldJewelleryItems: OldJewelleryDraftItem[];
  discountAmount: number;
  // Independently editable - not forced to a 50/50 split of one GST% field.
  cgstPercent: number;
  sgstPercent: number;
  payment: BillingPayment | null;
  fieldErrors: BillingFieldErrors;
  itemErrors: BillingItemErrors;

  setCustomer: (customer: BillingCustomer) => void;
  addItem: (item: Omit<BillingItem, "total" | "id">) => void;
  updateItem: (index: number, patch: Partial<Omit<BillingItem, "total" | "id">>) => void;
  removeItem: (index: number) => void;
  hasTag: (tagCode: string) => boolean;
  // addOldJewelleryItem takes no required fields - it seeds a blank row the
  // admin fills in, same "+ Add" affordance as the main items grid, rather
  // than a pre-populated item like a tag-linked addItem() call.
  addOldJewelleryItem: () => void;
  updateOldJewelleryItem: (id: string, patch: Partial<Omit<OldJewelleryDraftItem, "id">>) => void;
  removeOldJewelleryItem: (id: string) => void;
  setDiscountAmount: (amount: number) => void;
  setCgstPercent: (percent: number) => void;
  setSgstPercent: (percent: number) => void;
  setPayment: (payment: BillingPayment | null) => void;
  setValidationErrors: (fieldErrors: BillingFieldErrors, itemErrors: BillingItemErrors) => void;
  reset: () => void;
}

// total is always derived here, from calculations.ts, rather than trusted
// from whatever called addItem/updateItem - this is the one place the draft
// item's price is computed, so the number shown to the cashier and the
// number eventually sent in the POST body can never drift apart.
function withTotal(item: Omit<BillingItem, "total">): BillingItem {
  return {
    ...item,
    total: calculateItemTotal({
      netWtG: item.netWtG,
      ratePerGram: item.ratePerGram,
      makingCharge: item.makingCharge,
      stoneCharge: item.stoneCharge,
      pieces: item.pieces,
    }),
  };
}

// netWtG/calculatedValue are always derived here, same "never trust a
// passed-in total" rule as withTotal above - finalValue is deliberately
// NOT touched here, since it's a directly-editable field, not a pure
// formula output. Callers that change a weight/rate field are responsible
// for also re-syncing finalValue in their own patch when that's the
// intended behavior (see OldJewelleryExchangeSection.tsx) - this mirrors
// exactly how ItemTable.tsx's handleFieldChange decides whether to also
// patch makingCharge, kept at the call site rather than baked in here.
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

// Validation errors are always cleared the moment anything they could apply
// to changes - otherwise a fixed field would keep showing red (or a fixed
// row's error could silently point at the wrong row after items are
// reordered by a removal) until the next submit attempt recomputes them.
const NO_ERRORS = { fieldErrors: {}, itemErrors: {} };

export const useBillingStore = create<BillingState>((set, get) => ({
  customer: EMPTY_CUSTOMER,
  items: [],
  oldJewelleryItems: [],
  discountAmount: 0,
  // Sums to the same 3% the old single gstPercent field defaulted to.
  cgstPercent: 1.5,
  sgstPercent: 1.5,
  payment: null,
  fieldErrors: {},
  itemErrors: {},

  setCustomer: (customer) => set({ customer, ...NO_ERRORS }),

  addItem: (item) =>
    set((state) => ({
      items: [...state.items, withTotal({ ...item, id: crypto.randomUUID() })],
      ...NO_ERRORS,
    })),

  updateItem: (index, patch) =>
    set((state) => ({
      items: state.items.map((item, i) => (i === index ? withTotal({ ...item, ...patch }) : item)),
      ...NO_ERRORS,
    })),

  removeItem: (index) =>
    set((state) => ({ items: state.items.filter((_, i) => i !== index), ...NO_ERRORS })),

  // Used before adding a tag-linked item, to reject a second scan/pick of a
  // tag already in the current draft - a tag can't be sold twice in one
  // invoice (see docs/billing-plan.md decision 8, enforced again server-side).
  // Normalized to uppercase before comparing - tag codes are case-insensitive
  // everywhere else (Tag model stores uppercase, findTagByCode uppercases,
  // createInvoiceSchema's tag_code field uppercases), so a scan/typed code in
  // a different case than what's already in the cart must still be caught
  // here, not just at the final submit-time schema check.
  hasTag: (tagCode) =>
    get().items.some((item) => item.tagCode?.toUpperCase() === tagCode.toUpperCase()),

  addOldJewelleryItem: () =>
    set((state) => ({
      oldJewelleryItems: [
        ...state.oldJewelleryItems,
        withValuation({
          id: crypto.randomUUID(),
          description: "",
          metal: METALS[0],
          purity: "",
          grossWtG: 0,
          stoneWtG: 0,
          dustWtG: 0,
          otherDeductionWtG: 0,
          defaultRatePerGram: null,
          appliedRatePerGram: 0,
          finalValue: 0,
          overrideReason: "",
        }),
      ],
      ...NO_ERRORS,
    })),

  updateOldJewelleryItem: (id, patch) =>
    set((state) => ({
      oldJewelleryItems: state.oldJewelleryItems.map((item) =>
        item.id === id ? withValuation({ ...item, ...patch }) : item,
      ),
      ...NO_ERRORS,
    })),

  removeOldJewelleryItem: (id) =>
    set((state) => ({
      oldJewelleryItems: state.oldJewelleryItems.filter((item) => item.id !== id),
      ...NO_ERRORS,
    })),

  setDiscountAmount: (discountAmount) => set({ discountAmount, ...NO_ERRORS }),
  setCgstPercent: (cgstPercent) => set({ cgstPercent, ...NO_ERRORS }),
  setSgstPercent: (sgstPercent) => set({ sgstPercent, ...NO_ERRORS }),
  setPayment: (payment) => set({ payment, ...NO_ERRORS }),
  setValidationErrors: (fieldErrors, itemErrors) => set({ fieldErrors, itemErrors }),

  reset: () =>
    set({
      customer: EMPTY_CUSTOMER,
      items: [],
      oldJewelleryItems: [],
      discountAmount: 0,
      cgstPercent: 1.5,
      sgstPercent: 1.5,
      payment: null,
      ...NO_ERRORS,
    }),
}));
