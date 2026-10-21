import { create } from "zustand";
import { calculateItemTotal } from "@/features/billing/lib/calculations";

export interface BillingCustomer {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface BillingItem {
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
  makingCharge: number;
  stoneCharge: number;
  total: number;
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
  discountAmount: number;
  gstPercent: number;
  payment: BillingPayment | null;
  fieldErrors: BillingFieldErrors;
  itemErrors: BillingItemErrors;

  setCustomer: (customer: BillingCustomer) => void;
  addItem: (item: Omit<BillingItem, "total">) => void;
  updateItem: (index: number, patch: Partial<Omit<BillingItem, "total">>) => void;
  removeItem: (index: number) => void;
  hasTag: (tagCode: string) => boolean;
  setDiscountAmount: (amount: number) => void;
  setGstPercent: (percent: number) => void;
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
    }),
  };
}

// Validation errors are always cleared the moment anything they could apply
// to changes - otherwise a fixed field would keep showing red (or a fixed
// row's error could silently point at the wrong row after items are
// reordered by a removal) until the next submit attempt recomputes them.
const NO_ERRORS = { fieldErrors: {}, itemErrors: {} };

export const useBillingStore = create<BillingState>((set, get) => ({
  customer: EMPTY_CUSTOMER,
  items: [],
  discountAmount: 0,
  gstPercent: 3,
  payment: null,
  fieldErrors: {},
  itemErrors: {},

  setCustomer: (customer) => set({ customer, ...NO_ERRORS }),

  addItem: (item) => set((state) => ({ items: [...state.items, withTotal(item)], ...NO_ERRORS })),

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
  hasTag: (tagCode) => get().items.some((item) => item.tagCode === tagCode),

  setDiscountAmount: (discountAmount) => set({ discountAmount, ...NO_ERRORS }),
  setGstPercent: (gstPercent) => set({ gstPercent, ...NO_ERRORS }),
  setPayment: (payment) => set({ payment, ...NO_ERRORS }),
  setValidationErrors: (fieldErrors, itemErrors) => set({ fieldErrors, itemErrors }),

  reset: () =>
    set({
      customer: EMPTY_CUSTOMER,
      items: [],
      discountAmount: 0,
      gstPercent: 3,
      payment: null,
      ...NO_ERRORS,
    }),
}));
