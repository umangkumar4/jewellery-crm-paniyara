# Old Jewellery Exchange — Implementation Plan

> **Status: Steps 1-7 built and verified (typecheck/lint/build all clean); standalone Old Jewellery Purchase page also built. Customer Credit was built, then explicitly removed - Refund is the only excess-settlement option.** This records the scope and sequencing decisions worked out before writing any code, the same way `billing-plan.md` and `metal-rates-plan.md` do. Source requirements: `~/Downloads/jewellery_old_gold_exchange_full_decisions.md` (the full business decisions doc) and `~/Downloads/Jewellery_Customer_Credit_Final_Updated.md` (the credit approach that was built and then removed - see "Customer Credit — built, then explicitly removed" below). If this file and either source doc ever disagree on something already decided here, this file is the more recent decision.
>
> **Built so far:**
> - **Step 1 (Foundation):** `PurchaseCounter`, `OldJewelleryItem`, `OldJewelleryPurchase` models; `MetalPurity.purchaseRatePerGram`; `Invoice.exchangeApplied`/`linkedOldPurchaseId`/`linkedOldPurchaseNo`; `calculateOldJewelleryItemValuation()` in `calculations.ts`.
> - **Step 2 (Billing UI):** Purchase-rate editing added to the existing `MetalRateForm`/`MetalRatesTable` (a second independent rate field, not a new screen). `useBillingStore` gained `oldJewelleryItems[]` + `addOldJewelleryItem`/`updateOldJewelleryItem`/`removeOldJewelleryItem`. Items are entered via a modal (`AddOldJewelleryItemDialog.tsx`, mirroring `ManualAddForm`'s "Add Item" pattern). **Corrected a second time after initial build:** the list view is a real HTML `<table>` with its own column headers (Description/Metal/Purity/Gross/Stone/Dust/Other Ded./Net Wt/Rate/Value), matching the main Items grid's visual layout - not a compact card row. Still not ag-grid (too heavy for a handful of rows) - styled to match `AG_GRID_HEADER_CLASS`'s look instead. Rows are click-to-edit (reopens the dialog pre-filled, same convention `MakingChargeDialog` uses), with a separate remove icon. `addOldJewelleryItem` takes the fully-filled item from the dialog, not a blank seed row.
> - **Step 3 (Settlement math):** `calculateExchangeApplied()` (shared by `TotalsPanel` and `billing/page.tsx`) and the rewritten `calculateNewPending()` (now takes `exchangeApplied`/`creditUsed`, returns `remainingBeforePayment`) are both built and wired in. `TotalsPanel` shows a live "Exchange Applied" settlement line. `PaymentPanel`'s cap and "Pay remaining"/"Pay full amount" label now reflect the exchange-reduced amount. **Finalize is unconditionally blocked whenever any old jewellery item is present** - a deliberate, temporary safety gate (not a bug) until Step 5 teaches the backend to actually persist exchange data; see the Step 3 plan below for why. `invoices/[id]/page.tsx`'s Collect Payment call site passes `0, 0` placeholders for exchange/credit, unaffected until Step 6.
> - **Step 4 (Refund excess):** `useBillingStore` gained `refund: OldJewelleryRefundDraft` (`mode`/`reference`/`remarks`/`confirmed` - deliberately no `amount` field, always re-derived live from `calculateExchangeApplied()` so it can never drift stale) + `updateRefund()`. New `RefundSection.tsx` renders only while `excessAmount > 0`, replacing the Step 3 placeholder note. Refund mode is a narrower 3-value enum (Cash/UPI/Bank Transfer, no Card) than the existing payment mode type, matching the source docs' own language for payouts. Confirmed zero interaction with `PaymentPanel`/payment math/`canFinalize` - still blocked by Step 3's gate.
> - **Step 5 (Backend wiring):** `createInvoice` extended with the exchange path (idempotency check, server-computed `exchangeApplied`/`excessAmount`, refund-match verification, `OldJewelleryPurchase`/`OldJewelleryItem` creation, link-back) inserted around the existing tag-check/invoice-number/customer-upsert steps without reordering them. **Found and fixed a real bug during the required impact analysis**: `addPayment()`'s safety check didn't account for `exchangeApplied`, which would have allowed over-collecting cash on an exchange-settled invoice - fixed in both `addPayment()` and the new `createInvoice` check, both reusing `PaymentExceedsBalanceError` with an updated message. Also hardened a genuine (if rare) concurrent-duplicate-`operation_id` race at the unique-index level, mirroring `metalPuritiesService.ts`'s existing pattern for the same class of race. `canFinalize`'s Step 3 unconditional block is now real validation (`isOldJewelleryItemValid`, refund completeness) - Finalize works end to end for exchange sales. Dashboard aggregations, status badges, and print pages verified unaffected by reading the actual code, not assumption.
> - **Step 6 (Settlement display + Purchase Receipt):** New, isolated read-only stack for the receipt - `oldJewelleryPurchasesService.ts`, `GET /api/old-purchases/:id` (one route, not two - print-only, no separate detail page), `useOldPurchaseDetail.ts`, `PrintOldJewelleryPurchase.tsx` (English-only, A4 portrait), `/old-purchases/[id]/print`. Zero schema/model changes and zero changes to any write path - confirmed lower-risk than Step 5 by design, not just in hindsight.
> - **Step 6 follow-up (`PrintInvoice.tsx` restructure, iterated via an Artifact preview first):** Discount moved above Taxable Amount in the breakdown panel. The main sales invoice now fetches the linked old purchase (`useOldPurchaseDetail`) and, when `exchange_applied > 0`, shows a full Old Jewellery Exchange items table (Sr/Description/Metal/Purity/Gross/Stone/Dust/Net Wt/Rate/Value - no HSN/Pcs/Making/Stone Charge, those don't apply to a buy-back) below Grand Total, followed by Old Jewellery Total → Amount to Pay. Amount Paid/Balance Due moved out of the old Payment Summary box (now just Payment Mode) into this same section, always rendering, with Balance Due relabeled Total Remaining - same `invoice.pending_amount` value, already exchange-aware since Step 3/5, just relocated and renamed rather than recomputed. `invoicePrintLocale.ts` gained/renamed keys accordingly in both `en`/`hi`.
> - **Step 6 follow-up #2 (`invoices/[id]/page.tsx` parity fix):** Brought the admin detail page in line with the print restructure, scoped to that page's own conventions rather than copying print's styling - a second `AgGridReact` (matching this page's existing ag-grid items table, not `PrintInvoice.tsx`'s bordered-HTML-table style) shows the old jewellery items when `exchange_applied > 0`, and the Totals `<dl>` gained an "Amount to Pay" row between Exchange Applied and Paid. Deliberately did **not** rename "Paid"/"Pending" to match the print page's "Amount Paid"/"Total Remaining" - those are this app's established admin-UI terms (invoice list, dashboard), and renaming only here would trade one inconsistency for another. Zero backend changes - reuses the exact `useOldPurchaseDetail` hook and `/api/old-purchases/:id` route Step 6 already built.
> - **Step 7 (Inventory status management):** `OldJewelleryItem.purchaseId` widened to `Types.ObjectId | OldJewelleryPurchaseDocument` (same union-with-populated-document convention as `Tag.model.ts`'s `purityId`) - confirmed safe by grep, nothing read `.purchaseId` off a loaded document before this. `OldJewelleryStatusChange.changedBy` made nullable (same no-admin-identity-threading gap as `OldJewelleryPurchase.createdBy` from Step 5). New `changeOldJewelleryItemStatusSchema` (status enum `DISPOSED`/`MELTED`, required reason). `oldJewelleryPurchasesService.ts` gained `listOldJewelleryItems()` (paginated, optional status filter, populates `purchaseId` for the Purchase No column), `changeOldJewelleryItemStatus()` (only legal transition is `IN_SHOP` → `DISPOSED`/`MELTED`, terminal once left `IN_SHOP`, pushes a `statusHistory` entry), and their typed errors (`OldJewelleryItemNotFoundError`, `InvalidStatusTransitionError`). New routes `GET /api/old-items` and `PATCH /api/old-items/:id/status`. New `useOldJewelleryItems.ts` hook (list + `useChangeOldJewelleryItemStatus` mutation). New `/old-inventory` page: `OldJewelleryInventoryGrid.tsx` (ag-grid, status filter, same pagination pattern as `InvoiceGrid.tsx`) + `ChangeItemStatusDialog.tsx` (no-`open`-prop convention, mirrors `AddOldJewelleryItemDialog`). One new Sidebar nav entry ("Old Jewellery"). Zero changes to any existing write path (billing, invoice creation/payment, purchase receipt) - this step only adds a new read/status-transition surface on top of the `OldJewelleryItem` collection Step 1 already created.
> - **Standalone Old Jewellery Purchase page (sell-without-buy):** Built fully isolated from the billing flow per explicit instruction - zero changes to `useBillingStore`, any `features/billing/*` component (beyond reusing the already store-agnostic `AddOldJewelleryItemDialog` as-is), `invoicesService.ts`, or `invoice.schema.ts` (beyond adding `export` to 3 existing sub-schemas for reuse, no behavior change). New `OldJewelleryPurchase.operationId` field (nullable, sparse-unique-indexed) - idempotency for this path only; the billing_exchange path stays covered by `Invoice.operationId` as before, so every existing purchase row keeps this null. New `standaloneOldJewelleryPurchase.schema.ts` (customer + items + refund + required `operation_id`, refund must match 100% of item value - there's no bill to offset against, unlike the exchange path's excess-only refund). New `createStandaloneOldJewelleryPurchase()` in `oldJewelleryPurchasesService.ts`, mirroring `createInvoice()`'s transaction/idempotency/customer-upsert shape without any tag/GST machinery. New `POST /api/old-purchases` (the existing `GET /api/old-purchases/:id` print route is untouched and already worked correctly for `source: "standalone"` with no changes - `linked_invoice_no` was already nullable-safe). New, fully independent `useOldPurchaseStore.ts` (reuses `OldJewelleryDraftItem`/`RefundMode`/`OldJewelleryRefundDraft` as type-only imports from `useBillingStore.ts`, no runtime coupling) + `StandaloneCustomerFields.tsx`/`StandaloneItemsSection.tsx`/`StandaloneRefundSection.tsx` (parallel, separate components - billing's `CustomerFields.tsx`/`OldJewelleryExchangeSection.tsx`/`RefundSection.tsx` untouched) + `useCreateOldPurchase.ts`. New nested route `/old-inventory/new` (not a new sidebar entry - reached via a "New Purchase" button added to the already-shipped `OldJewelleryInventoryGrid.tsx`, the only edit to a previously-built file).

---

## Scope decision

Two features were on the table — old jewellery exchange applied to a bill, and a customer credit/wallet system for excess value. **Only the first is the actual ask.** The credit/wallet system, and the standalone Old Jewellery Purchase page (sell-without-buy), are both explicitly deferred to a last phase — neither was the requested feature, and neither blocks the core exchange deduction from working.

**In scope now:** old jewellery value entered during billing, automatically applied against the new invoice's grand total, with the common "old jewellery is worth more than the bill" case handled by a manual refund (no persistent balance).

**Deferred to a last phase:**
- ~~Standalone Old Jewellery Purchase page (sell-without-buy).~~ Built - see "Built so far" above.
- ~~Customer Credit — "Keep as Credit" as a second excess option, wallet balance + immutable ledger, spending credit on a later bill, manual withdrawal, Customers-page "Available Credit" column + "Has Credit" filter, customer-detail credit history.~~ Built, then explicitly **removed** - see "Customer Credit — built, then explicitly removed" below. Refund is the only excess-settlement option.

---

## Key decisions already resolved

1. **Net weight entry mode (Decision 15 in the source doc): auto-derive only.** `Net weight = Gross − Stone − Dust − Other deduction`, always computed, not directly editable — same pattern the existing new-jewellery billing form already uses (gross − stone auto-derives and overwrites manual edits).

2. **Purchase rate catalog: reuse the existing `MetalPurity` list, don't duplicate it.** Originally planned as a separate `PurchaseRate` collection with its own metal/purity rows, which would have forced the admin to maintain two parallel catalogs and risked a purity existing on one side but not the other. Corrected: add a second field, `purchaseRatePerGram` (nullable, independent of the existing `ratePerGram`), directly on `MetalPurity`. One catalog, two independent rate numbers per row — updating the sell rate never touches the purchase rate and vice versa, which was the only real thing worth protecting.

3. **Settlement math — exchange-first, sequential buckets.** The new jewellery invoice's `grandTotal` is never changed by an exchange; old jewellery value and credit are settlement lines, not discounts. Applied in a fixed order, each step capped by what's left after the previous one:
   ```
   remaining0 = grandTotal
   exchangeApplied = min(oldJewelleryValue, remaining0)     // mandatory first, not skippable
   remaining1 = remaining0 − exchangeApplied
   // (creditUsed comes later, in the deferred Credit phase — remaining1 passes straight through for now)
   paidAmount ≤ remaining1                                   // existing cash/UPI/card/bank, capped against what's actually still due
   pendingAmount = max(0, remaining1 − paidAmount)
   paymentStatus = (exchangeApplied + paidAmount) >= grandTotal ? "paid"
                 : (exchangeApplied + paidAmount) > 0        ? "partial"
                 : "unpaid"
   ```
   `calculateNewPending(grandTotal, paidAmount)` currently only knows about cash — it has to grow to take `exchangeApplied` too, or a bill fully settled by exchange with ₹0 cash would wrongly show as 100% unpaid. Every call site (`billing/page.tsx`, the invoice detail "Collect Payment" flow) needs updating to pass it.

4. **Excess handling in this phase: Refund only.** When old jewellery value exceeds the bill, the excess is recorded as a one-time manual payout — no running balance, no ledger, no double-spend risk, because nothing persists across visits yet. "Keep as Credit" isn't an available choice until the deferred Credit phase adds it.

5. **Backend enforcement is a deliberate exception to this app's usual rule.** The rest of the billing module trusts client-computed GST/pricing math and only sanity-bounds it (±₹1 tolerance) — see `billing-how-it-works.md` §4/§9. The exchange-first cap (`exchangeApplied` can never exceed `grandTotal`) is real money changing hands and has to be enforced server-side inside the transaction, not just displayed correctly client-side.

---

## Phases, ordered by dependency

Critical path is **1 → 2 → 3 → 4 → 5 → 6**, with 7 trailing at the end with zero downstream risk.

### 1. Foundation — data model + valuation engine
`OldJewelleryPurchase` / `OldJewelleryItem` / `PurchaseCounter` models (the last mirrors `InvoiceCounterModel`'s atomic `$inc` ticket-dispenser pattern for purchase reference numbers). The pure calculation layer: net weight = gross − stone − dust − other deduction; item value = net weight × rate, with per-item rate override and final-value override, both traceable (snapshot of default rate, applied rate, calculated value, final value, override reason). Also includes adding `purchaseRatePerGram` to the existing `MetalPurity` model here, since it's a trivial addition alongside the other model work. Nothing downstream can be built without this existing first.

### 2. Billing UI — Old Jewellery Exchange section
Multi-item entry form inside the Billing page, using step 1's valuation engine live. The purity dropdown prefills `purchaseRatePerGram` from the existing purity list (same prefill-then-overridable pattern the sell-side item form already uses), and the existing Settings purity form gets one new input field to set/edit that rate. Each old item gets its own inventory identity (`IN_SHOP` default status), even though several items share one purchase reference.

### 3. Exchange-first settlement math
`exchangeApplied = min(oldJewelleryValue, grandTotal)`, auto-applied, and the `calculateNewPending` rewrite described above.

### 4. Excess handling — Refund only
The branch that appears when old jewellery value exceeds the bill: admin records a manual refund payout (method, amount, date, optional reference/remarks, explicit confirmation that the real-world payout happened). No credit path yet.

### 5. Backend transaction + validation wiring
One Mongo transaction (same `session.withTransaction` auto-retry pattern `invoicesService.createInvoice` already uses) writing Invoice (with new `exchangeApplied`/`linkedOldPurchaseId` fields) + `OldJewelleryPurchase` + `OldJewelleryItem`s + optional refund record together or not at all. Zod schema extension (`invoice.schema.ts`) for the new request shape. Developed alongside steps 2-4, not strictly after them, since the UI and the schema/service layer share the same field shapes.

### 6. Settlement breakdown + printable documents
Invoice detail/print showing exchange applied + remaining due + linked purchase reference (the existing invoice total stays untouched, just a new breakdown line beneath it), plus a printable Old Jewellery Purchase Receipt (purchase reference, items, weights/deductions, agreed value, amount applied to the invoice, amount refunded).

### 7. Inventory status management (Disposed / Melted)
`IN_SHOP` as a default falls out of step 1 for free. The admin-facing "mark Disposed/Melted with a reason" screen is a true leaf — nothing else in this phase depends on it, safe to build last or slip to right after this phase ships without blocking anything.

---

## Phase 1 — Technical implementation plan

Grounded directly in this codebase's existing conventions (`invoicesService.ts`'s transaction pattern, `TagNotFoundError`-style typed errors mapped to HTTP status in the route handler, Zod `.refine()` cross-field checks, `validationErrorResponse()`'s `{error, fields}` 422 envelope, `ApiError`'s `{status, fields, codes}` client shape). Nothing here invents a new pattern - everything reuses one already proven in this app.

### Three decisions made while writing this plan (flagging them, not burying them)

1. **`calculateNewPending` reserves a `creditUsed` parameter now, always `0` in Phase 1.** Costs nothing, means the deferred Credit phase touches zero existing call sites later - it just starts passing a real number instead of `0`.
2. **`OldJewelleryPurchase` gets a `status: "active" | "cancelled"` field now, even though the cancel workflow itself is deferred.** One enum field, defaulted to `"active"`, so a future cancel-and-recreate feature doesn't need a schema migration.
3. **Idempotency is real in Phase 1, not deferred to Credit.** Double-clicking "Finalize Sale" with an exchange attached could create two purchase records, mark the same physical items twice, or - worst case - risk a refund being processed twice. That's a Phase 1 money risk, independent of whether a wallet exists. A client-generated `operation_id` (UUID), unique-indexed, checked before the transaction runs, closes this - if a record with that id already exists, the existing result is returned instead of creating a duplicate. (This is also a pre-existing gap in today's plain `createInvoice` - worth the same fix while this transaction is being touched anyway, flagging for a separate small follow-up rather than silently expanding this phase's scope.)

### A. Data models

**`MetalPurity.model.ts` (extend existing)**
```ts
purchaseRatePerGram: { type: Number, min: 0, default: null }  // independent of existing ratePerGram
```

**`PurchaseCounter.model.ts` (new)** - exact mirror of `InvoiceCounterModel`:
```ts
{ _id: number /* calendar year */, lastNumber: number }
```

**`OldJewelleryItem.model.ts` (new)** - its own collection, not embedded, for independent per-item stock status:
```ts
{
  purchaseId: ObjectId,              // ref OldJewelleryPurchase
  srNo: number,                      // server-assigned, index+1, same convention as InvoiceItem
  description: string,
  metal: string,
  purity: string,
  grossWtG: number,                  // > 0
  stoneWtG: number,                  // >= 0, default 0
  dustWtG: number,                   // >= 0, default 0
  otherDeductionWtG: number,         // >= 0, default 0
  netWtG: number,                    // auto-derived: max(0, gross - stone - dust - other), rounded 3dp - Decision 15
  defaultRatePerGram: number | null, // snapshot of MetalPurity.purchaseRatePerGram at entry time, null if not configured
  appliedRatePerGram: number,        // > 0, prefilled from default, admin-overridable
  calculatedValue: number,           // round(netWtG * appliedRatePerGram)
  finalValue: number,                // >= 0, defaults to calculatedValue, admin-overridable
  overrideReason: string,            // optional free text, recorded whenever finalValue !== calculatedValue
  status: "IN_SHOP" | "DISPOSED" | "MELTED",  // default IN_SHOP
  statusHistory: [{ from: string, to: string, reason: string, changedBy: ObjectId, changedAt: Date }], // empty at creation
}
```

**`OldJewelleryPurchase.model.ts` (new)**
```ts
{
  purchaseNo: string,                 // "OJP-2026-0001", atomic counter
  customerId: ObjectId,
  customer: { name, phone, email?, address? },  // denormalized snapshot, same convention as Invoice.customer
  source: "billing_exchange" | "standalone",     // always "billing_exchange" in Phase 1
  linkedInvoiceId: ObjectId | null,
  totalPurchaseValue: number,         // sum of item finalValues
  appliedToInvoice: number,           // = exchangeApplied, denormalized for the receipt
  excessAmount: number,               // max(0, totalPurchaseValue - grandTotal)
  excessSettlement: "refund" | "credit" | null,  // Phase 1 only ever writes "refund" or null
  refund: {
    amount: number, mode: "cash"|"upi"|"card"|"bank_transfer",
    reference: string | null, remarks: string | null, confirmedAt: Date,
  } | null,
  status: "active" | "cancelled",     // default "active", reserved per decision 2 above
  createdBy: ObjectId,                // ref User - real field, this app does have multiple admin logins
}
```

**`Invoice.model.ts` (extend existing)**
```ts
exchangeApplied: { type: Number, required: true, min: 0, default: 0 },
linkedOldPurchaseId: { type: Schema.Types.ObjectId, default: null },
linkedOldPurchaseNo: { type: String, default: null },  // denormalized, avoids a join on every invoice read/print
```
Everything else on `Invoice` is untouched.

### B. Calculation layer (`calculations.ts` additions)

```ts
calculateOldJewelleryItemValue({ grossWtG, stoneWtG, dustWtG, otherDeductionWtG, ratePerGram }):
  netWtG = round(max(0, grossWtG - stoneWtG - dustWtG - otherDeductionWtG), 3dp)
  calculatedValue = round(netWtG * ratePerGram)
  // finalValue is a separate, UI-level override - not computed here

calculateNewPending(grandTotal, exchangeApplied, creditUsed /* = 0 in Phase 1 */, paidAmount):
  remaining1 = max(0, grandTotal - exchangeApplied)
  remaining2 = max(0, remaining1 - creditUsed)
  pendingAmount = max(0, remaining2 - paidAmount)
  settled = exchangeApplied + creditUsed + paidAmount
  paymentStatus = settled >= grandTotal ? "paid" : settled > 0 ? "partial" : "unpaid"
```
`exchangeApplied` and `excessAmount` are **server-computed, not client-sent** - see §D. The client still runs the identical formula locally for the live on-screen preview (same `calculateInvoiceTotals` pattern: client computes for display, server is the actual source of truth for what gets persisted).

### C. Zod schema additions (`invoice.schema.ts`)

```ts
const oldJewelleryItemInputSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  metal: z.string().trim().min(1, "Metal is required"),
  purity: z.string().trim().min(1, "Purity is required"),
  gross_wt_g: z.number().positive("Gross weight is required"),
  stone_wt_g: z.number().min(0).default(0),
  dust_wt_g: z.number().min(0).default(0),
  other_deduction_wt_g: z.number().min(0).default(0),
  net_wt_g: z.number().min(0),
  applied_rate_per_gram: z.number().positive("Rate is required"),
  calculated_value: z.number().min(0),
  final_value: z.number().min(0),
  override_reason: z.string().trim().optional(),
}).refine(
  (item) => item.stone_wt_g + item.dust_wt_g + item.other_deduction_wt_g <= item.gross_wt_g,
  { message: "Deductions cannot exceed gross weight", path: ["gross_wt_g"] },
);
```

Extend `createInvoiceSchema`'s top-level object with:
```ts
old_jewellery_items: z.array(oldJewelleryItemInputSchema).default([]),
excess_settlement: z.enum(["refund"]).nullable().default(null),  // only "refund" is a valid value in Phase 1
refund: z.object({
  amount: z.number().positive(),
  mode: paymentModeSchema,
  reference: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
}).optional(),
operation_id: z.string().uuid("Invalid operation id"),  // idempotency key, decision 3
```
New cross-field `.refine()`s, same style as the existing `grand_total`/`cgst_amount` checks:
- If `old_jewellery_items` is non-empty and `sum(final_value) > grand_total`: `excess_settlement` must be `"refund"` and `refund` must be present, with `refund.amount` matching the excess within ₹1 tolerance.
- If `sum(final_value) <= grand_total`: `excess_settlement` must be `null` and `refund` must be absent (rejects a stray refund when there's no excess - defensive, shouldn't be reachable from the UI).

### D. Service layer (`invoicesService.ts` additions)

New typed errors, same pattern as `TagNotFoundError`:
```ts
export class DuplicateOperationError extends Error { constructor(public readonly existingInvoiceId: string) {...} }
export class RefundMismatchError extends Error { constructor(public readonly expected: number, public readonly got: number) {...} }
```

`createInvoice`'s transaction gains these steps, inserted into the existing flow (tag checks → customer upsert → invoice number, unchanged):

1. **Idempotency check** (new, first step inside the session): look up `operation_id` against a lightweight index (either a dedicated `IdempotencyKey` collection or a unique index on `Invoice.operationId` directly - leaning toward a field directly on `Invoice`, one fewer collection). If found, return the existing invoice instead of re-running anything else - this is a success path, not an error.
2. Tag checks (existing, unchanged).
3. **Server computes `exchangeApplied` and `excessAmount` directly** from `sum(old_jewellery_items[].final_value)` and the already-validated `grand_total` - not merely sanity-checking a client-sent number, actually computing it. This is the one deliberate exception to "client math is authoritative" (decision 20's explicit mandatory requirement for money that leaves/enters outside normal payment).
4. If `excessAmount > 0`: verify `refund.amount` matches `excessAmount` (₹1 tolerance) - throw `RefundMismatchError` otherwise. (This duplicates the Zod refine from §C deliberately - the Zod check protects the HTTP boundary, this one protects the transaction itself in case the two ever drift, same defensive-depth reasoning as the existing `grand_total` tolerance check appearing in both places conceptually.)
5. Customer upsert, invoice number (existing, unchanged).
6. If `old_jewellery_items.length > 0`: get next purchase number (same atomic `$inc` pattern as `getNextInvoiceNumber`), create the `OldJewelleryPurchase` document (status `"active"`, `excessSettlement`/`refund` from step 3-4), then create each `OldJewelleryItem` document (`status: "IN_SHOP"`).
7. Create the `Invoice` document with `exchangeApplied`, `linkedOldPurchaseId`, `linkedOldPurchaseNo` set (all `0`/`null` when there were no old jewellery items - this is the regression-safety path, see scenario table below).
8. If a purchase was created, update it with `linkedInvoiceId` now that the invoice id exists (two writes in the same session - no FK constraint in Mongo, this is fine).

### E. API route changes

`POST /api/invoices` - same route, extended body, extended error mapping:
```
404 - TagNotFoundError            (existing, unchanged)
409 - TagAlreadySoldError         (existing, unchanged)
422 - RefundMismatchError         (new) - "Refund amount does not match the exchange excess"
200 - DuplicateOperationError     (new) - NOT an error response; returns the original invoice_id/invoice_no exactly
       as if this were the first successful call, so a retried request is transparent to the caller
500 - anything else, logged via logger.error (existing, unchanged)
```

`GET /api/invoices/:id` (`serializeInvoice`) - add `exchange_applied`, `linked_old_purchase_id`, `linked_old_purchase_no` to the response.

`GET /api/old-purchases/:id` (new) - purchase receipt data: purchase header + all its items + linked invoice reference. Same `findInvoiceById`-style convention (malformed id → `null` → clean 404, never a 500 from a `CastError`).

`GET /api/old-purchases/:id/print` (new) - same shape as detail, for the printable receipt.

### F. Frontend

- `OldJewelleryExchangeSection.tsx` (new, in `src/features/billing/components/`) - multi-item entry inside the Billing page. **Not ag-grid** - a simple repeated-row/card list, confirmed since a typical exchange is expected to be a handful of items (a ring, a chain, maybe a bangle set), not the dozens a sale's main Items grid can hold. Each row: description, metal/purity, gross/stone/dust/other-deduction inputs, computed net weight (read-only), rate (prefilled from `purchaseRatePerGram`, overridable), computed value, remove button - plus an "Add old jewellery item" action, same shape as the preview above.
- `useBillingStore.ts` gains `oldJewelleryItems: OldJewelleryItem[]`, `excessSettlement`, `refund` state, plus `addOldJewelleryItem`/`updateOldJewelleryItem`/`removeOldJewelleryItem` actions - same shape as the existing `items[]` actions.
- Live client-side preview reuses `calculateOldJewelleryItemValue`/the extended `calculateNewPending`, exactly mirroring how `TotalsPanel` already works today.
- `billing/page.tsx`'s `handleFinalize` generates a fresh `operation_id` (UUID) once per finalize attempt (not regenerated on retry within the same click-to-success cycle, so a network-level retry of the same request reuses the same id and hits the idempotency path, not a fresh duplicate attempt).
- Settlement breakdown display (exchange applied / remaining due / linked purchase reference) added to the existing Totals & Payment panel and to `PrintInvoice.tsx`.
- Client-side live validation (mirrors `getLiveItemErrors`) extended to old-jewellery rows: deductions > gross, non-positive rate, missing description all turn the row red before submit, same UX as the existing items grid.

### G. Full scenario / error-handling catalog

| # | Scenario | Detected where | Result |
|---|---|---|---|
| 1 | Old item: negative/zero gross weight | Zod `positive()` | 422, red field, same as existing gross_wt_g |
| 2 | Old item: deductions (stone+dust+other) exceed gross | Zod `.refine()` | 422, "Deductions cannot exceed gross weight" |
| 3 | Old item: rate not entered (0) | Zod `positive()` + client-side live check | 422 / Finalize disabled before submit |
| 4 | Excess exists, no settlement choice sent | Zod `.refine()` | 422, "Choose Refund for the excess amount" |
| 5 | No excess, but refund/settlement sent anyway | Zod `.refine()` | 422 - defensive, shouldn't be reachable from the UI |
| 6 | Refund amount doesn't match excess | Zod `.refine()` (HTTP boundary) + service-layer `RefundMismatchError` (transaction boundary) | 422, "Refund amount does not match the exchange excess" |
| 7 | Refund mode missing | Zod, nested object required when `excess_settlement === "refund"` | 422 |
| 8 | Tag already sold / not found (existing items in same sale) | `TagNotFoundError`/`TagAlreadySoldError`, unchanged | 404 / 409, exact codes listed |
| 9 | Duplicate submission (double-click, network retry) | `operation_id` uniqueness check, step D.1 | 200/201 with the original result - not an error, a transparent replay |
| 10 | Two concurrent finalize attempts touching a new collection for the first time | Mongo `TransientTransactionError`, auto-retried by `session.withTransaction` | Invisible to the user; only surfaces as 500 if retries are exhausted |
| 11 | DB/transaction failure of any other kind | `catch` in route handler, `logger.error` | 500, "Internal server error" - logged with full context for debugging |
| 12 | Metal/purity has no `purchaseRatePerGram` configured yet | Prefill silently resolves to blank/0 | Admin must type the rate manually - same "Rate per gram is required" UX as the existing sell-side flow when no purity is picked |
| 13 | Admin removes an old item before finalizing | Pure client-side store mutation | No backend involvement, nothing to error-handle |
| 14 | Zero old-jewellery items (ordinary sale, no exchange) | `old_jewellery_items` omitted/empty | Entire exchange machinery no-ops: `exchangeApplied = 0`, `linkedOldPurchaseId = null` - **must behave identically to today's existing flow**, this is the regression-safety case to test first |
| 15 | Old jewellery value exactly equals grand total | Server computes `excessAmount = 0` | No settlement choice shown/required, `exchangeApplied = grandTotal`, invoice fully settled by exchange alone if no other payment |
| 16 | Multiple old items, one invalid | Same per-row red-highlight pattern as the existing new-jewellery items grid | Finalize blocked until that row is fixed, other rows unaffected |
| 17 | Session/auth expiry mid-entry | Existing `requireAuth` 401 handling, unchanged | Token cleared, redirected to `/login` - draft is lost, same as today for the rest of the billing form |
| 18 | Print/receipt requested for a non-existent or malformed purchase id | `findInvoiceById`-style null-return convention | Clean 404, never a 500 `CastError` |
| 19 | Client-displayed exchange/excess preview ever disagrees with what the server persists | Not reachable under correct code (both use the identical formula over the same inputs) - if it ever happens, it's a bug to fix in code review/testing, not a runtime failure mode, since the **server's computed number is what's actually persisted and charged**, not the client's preview |
| 20 | Admin finalizes with an old item whose `final_value` was manually overridden away from `calculated_value`, no reason given | Allowed - `override_reason` is optional, not blocking, matching this app's low-friction "admin-only, no approval chain" posture | Recorded as empty string, visible as blank on the receipt/audit view |

---

## Step 3 — Exchange-first settlement math (technical plan)

### The central safety decision - read this first

Step 2 built the item-entry UI; Step 5 is what actually teaches the backend to accept and persist old-jewellery/exchange data. Step 3 sits in between, and that gap is dangerous if not handled explicitly:

**Without a guard, it's possible to finalize a sale where the UI shows "paid via exchange" while the backend - which still knows nothing about exchange until Step 5 - persists an invoice with `paid_amount: 0` and `payment_status: "paid"`, with zero record of any exchange ever happening.** That's not a cosmetic bug, it's a real financial/audit gap: a sale marked fully paid with nothing behind it.

**The fix: `canFinalize` gets an unconditional new gate - `oldJewelleryItems.length === 0` - blocking Finalize entirely whenever any old jewellery item exists in the draft, regardless of whether it's valid, complete, within-bill, or in excess.** This is temporary, removed the moment Step 5 lands (which is what makes it safe to actually persist exchange data). Everything else in Step 3 - the live math, the display, the payment cap - is still built and fully working during this window, so it can be tested and verified correctly before Step 5 ever unblocks it for real submission. A clear, non-alarming message explains why ("Old jewellery exchange isn't finalizable yet - remove items to complete this sale, or wait for the next update").

### New calculation functions (`calculations.ts`)

```ts
export interface ExchangeSettlement {
  oldJewelleryTotal: number;  // sum of finalValues, rounded to whole rupee - the raw total before any capping
  exchangeApplied: number;    // min(oldJewelleryTotal, grandTotal) - what's actually applied
  excessAmount: number;       // max(0, oldJewelleryTotal - grandTotal) - what's left over, unhandled until Step 4
}

export function calculateExchangeApplied(
  oldJewelleryItems: { finalValue: number }[],
  grandTotal: number,
): ExchangeSettlement {
  const oldJewelleryTotal = Math.round(oldJewelleryItems.reduce((sum, item) => sum + item.finalValue, 0));
  const exchangeApplied = Math.min(oldJewelleryTotal, grandTotal);
  const excessAmount = Math.max(0, oldJewelleryTotal - grandTotal);
  return { oldJewelleryTotal, exchangeApplied, excessAmount };
}
```
Rounded to whole rupees here deliberately - `finalValue` is a free-typed field that could carry decimals (unlike `calculatedValue`, which is always `Math.round()`-ed), and every other money figure in this app (`grandTotal`, `pendingAmount`) is a whole rupee. Rounding at this single shared boundary stops fractional drift from ever entering the rest of the math.

This is the **one shared source of truth** for the exchange figures, called from every place that needs them (`TotalsPanel` for live display, `billing/page.tsx` for the payment cap and the eventual submit body) - same "the number shown and the number used can never drift apart" principle `calculateInvoiceTotals` already established for subtotal/GST.

```ts
export function calculateNewPending(
  grandTotal: number,
  exchangeApplied: number,
  creditUsed: number,  // always 0 in Phase 1 - reserved for the deferred Credit phase, no default so every caller states it explicitly
  paidAmount: number,
): NewPending {
  // Defensively clamped, same "never trust a raw input blindly even
  // internally" rule calculateInvoiceTotals already applies to discountAmount.
  const safeExchange = Math.min(Math.max(0, exchangeApplied), grandTotal);
  const safeCredit = Math.min(Math.max(0, creditUsed), grandTotal - safeExchange);
  const remainingBeforePayment = Math.max(0, grandTotal - safeExchange - safeCredit);
  const pendingAmount = Math.max(0, remainingBeforePayment - paidAmount);
  const settled = safeExchange + safeCredit + paidAmount;

  let paymentStatus: PaymentStatus = "unpaid";
  if (settled >= grandTotal) paymentStatus = "paid";
  else if (settled > 0) paymentStatus = "partial";

  return { pendingAmount, paymentStatus, remainingBeforePayment };
}
```
`remainingBeforePayment` is a new field on `NewPending`'s return shape - the amount still due after exchange/credit but before cash. Exposed so every caller (specifically `PaymentPanel`'s cap) reads it from here rather than each re-deriving `grandTotal - exchangeApplied` slightly differently at the call site.

### File-by-file changes

**`billing/page.tsx`**
- `const { exchangeApplied, excessAmount, oldJewelleryTotal } = calculateExchangeApplied(oldJewelleryItems, totals.grandTotal)`.
- `calculateNewPending(totals.grandTotal, exchangeApplied, 0, payment?.amount ?? 0)` - the `0` is the reserved `creditUsed` slot.
- `canFinalize` gains `&& oldJewelleryItems.length === 0` (the central safety gate above).
- `PaymentPanel`'s `grandTotal` prop changes from `totals.grandTotal` to `pendingResult.remainingBeforePayment` - this prop is already semantically "the cap," not literally the grand total (the invoice detail page's Collect Payment dialog already passes `invoice.pending_amount` here today, not a literal grand total), so this is reusing an existing convention, not inventing a new one.
- `payButtonLabel` becomes conditional: `exchangeApplied > 0 ? "Pay remaining" : "Pay full amount"`.
- A clear, visible message near the Finalize button whenever `oldJewelleryItems.length > 0`, explaining the block (see above) - and, non-blocking, an informational note when `excessAmount > 0` previewing what Step 4 will handle ("Old jewellery exceeds the bill by ₹X - refund/credit choice arrives in the next update").

**`TotalsPanel.tsx`**
- Reads `oldJewelleryItems` from the store directly (same convention as every other figure it already reads), calls the same `calculateExchangeApplied`.
- New settlement line, gated on `oldJewelleryItems.length > 0`: "Exchange Applied: −₹X", rendered **below** the existing Grand Total row, visually separated by its own divider - not mixed into the Subtotal/Discount/CGST/SGST block, since exchange never feeds into the taxable-amount calculation (guiding principle: never mislabeled as a discount).

**`invoices/[id]/page.tsx`**
- `calculateNewPending(invoice.grand_total, 0, 0, newPaid)` - both new parameters hardcoded to `0` for now, since `InvoiceDetail` doesn't carry `exchange_applied` yet (that's Step 6). Explicitly a placeholder, not an oversight - this call site gets wired to the real field once it exists. Behavior is byte-identical to before this change for every existing invoice.

### Full scenario table

| # | Scenario | Math result | UI behavior | Finalize allowed? |
|---|---|---|---|---|
| 1 | No old jewellery items at all | `exchangeApplied = 0` | No new UI appears - byte-identical to today | Yes - the regression-safety case, test this first |
| 2 | Old items present, total < grand total | `exchangeApplied = oldTotal`, remaining > 0 | "Exchange Applied" line shown, payment cap reduced, "Pay remaining" label | **No** - blocked by the central gate |
| 3 | Old items present, total = grand total | `exchangeApplied = grandTotal`, remaining = 0 | Payment input/mode disable gracefully at ₹0 (existing `amount <= 0` behavior, no new code needed) | **No** |
| 4 | Old items present, total > grand total (excess) | `exchangeApplied` capped at `grandTotal`, `excessAmount > 0` | Non-blocking info note previews Step 4 | **No** |
| 5 | Old item added then removed again | Reverts to scenario 1 exactly | All exchange UI disappears, gate re-evaluates live | Yes, once the list is empty |
| 6 | Payment typed before adding an exchange, now exceeds the shrunk cap | `remainingBeforePayment` drops below the already-typed amount | "Up to ₹X" hint shrinks to reflect it | Blocked anyway by the item-presence gate; resolves itself once items are removed |
| 7 | Old item added but never filled in (rate/purity blank, `finalValue = 0`) | Contributes ₹0 - safe by construction, not a special case | Still counts as "an item present" for the gate | Blocked (presence-based gate, not value-based - avoids ambiguity about whether a half-filled row should count) |
| 8 | Multiple old items, mixed valid/invalid | Only valid rows contribute real value | Each row shows its own computed value | Blocked (same coarse gate) |
| 9 | Items removed one at a time via the row's remove button | Each removal live-recomputes via the shared function | Exchange Applied shrinks row by row to ₹0, then the section/line disappears | Unblocks the moment the list is empty |
| 10 | Existing (already-finalized) invoice viewed on the detail page | `calculateNewPending(grand_total, 0, 0, newPaid)` | Identical to pre-Step-3 behavior | Unaffected - full backward compatibility |
| 11 | `reset()` after a successful ordinary sale | `oldJewelleryItems` cleared to `[]` (already wired in Step 2) | Next draft starts clean | N/A |
| 12 | A manually-typed `finalValue` carries decimals (e.g. 35000.50) | Rounded to whole rupee inside `calculateExchangeApplied`, once, at the shared boundary | Displayed as a whole rupee | N/A - no drift possible since there's one source of truth |
| 13 | Grand total itself happens to be ₹0 | `exchangeApplied = min(oldTotal, 0) = 0` always | No crash - formulas are division-free | Blocked only if old items are present, same rule as everywhere else |

### What Step 4 completes

The excess-exceeds-bill case (scenario 4) is the one deliberately incomplete piece here - Step 3 correctly caps `exchangeApplied` and surfaces the leftover as `excessAmount`, but offers no way to settle it yet (no refund choice exists until Step 4). That's why Finalize stays blocked for *any* old jewellery item, not just the excess case - a narrower guard that only blocked excess specifically would still let scenario 2/3 reach the still-nonexistent backend path, which is the exact gap this plan exists to close.

---

## Step 4 — Excess handling, Refund only (technical plan)

### Blast radius first - what this step does and does not touch

This is scoped as tightly as possible on purpose. Step 4 adds exactly one new piece of client-side draft state and one new component. It does **not** touch:
- `calculateInvoiceTotals`, `calculateItemTotal`, `calculateExchangeApplied`, or `calculateNewPending` - no new formulas, `excessAmount` already exists from Step 3.
- `PaymentPanel`, the payment cap (`remainingBeforePayment`), or anything about collecting cash/UPI/card payment from the customer. Refund is money the **shop pays out**; payment collection is money the **shop takes in** - financially independent flows that happen to both be settlement-adjacent. When excess exists, `exchangeApplied` is already capped at `grandTotal` (from Step 3), so `remainingBeforePayment` is already `0` - the bill is fully settled by exchange alone, before refund ever enters the picture. Refund never changes what PaymentPanel shows or caps.
- `canFinalize` - still unconditionally blocked by `oldJewelleryItems.length === 0` from Step 3, unchanged. Nothing in Step 4 can be submitted yet either, same reason as the rest of the exchange UI (Step 5 hasn't taught the backend to persist any of this).
- The main Items grid, `TotalsPanel`'s existing Subtotal/Discount/CGST/SGST/Grand Total rows, or anything about new-jewellery items.

### The one design decision that eliminates a whole bug class

Per the confirmed "exact match only" rule, the refund amount is never a free-choice number - it's always exactly `excessAmount`. So **the refund amount is never stored as its own piece of state at all** - it's read live from `calculateExchangeApplied()` every time it's displayed, never copied into a separate field that could go stale or drift out of sync if old jewellery items change after the admin opens the refund form. Only the genuinely free-form parts - mode, reference, remarks, confirmation - are stored as draft state. This isn't a simplification for convenience, it's removing the only field that could otherwise become a source of the exact "small miss, several bugs" risk being guarded against here.

### New store state (`useBillingStore.ts`)

```ts
export type RefundMode = "cash" | "upi" | "bank_transfer";  // deliberately narrower than
// BillingPaymentMode (which also has "card") - both source requirement docs
// consistently list only Cash/UPI/Bank Transfer for refunds and withdrawals,
// never card. A shop doesn't "pay out" over a card network.

export interface OldJewelleryRefundDraft {
  mode: RefundMode | null;  // null = not yet chosen
  reference: string;
  remarks: string;
  confirmed: boolean;  // "I confirm this refund has been paid outside the software"
}
```
Always a plain object, never `null` - `RefundSection` only renders while `excessAmount > 0` anyway, so there's no need for a nullable wrapper to represent "not applicable." One `updateRefund(patch: Partial<OldJewelleryRefundDraft>)` action (single setter, consistent with how few fields this is), defaulting to `{ mode: null, reference: "", remarks: "", confirmed: false }`. `reset()` restores that default alongside everything else it already clears.

### New component (`RefundSection.tsx`)

Reads `oldJewelleryItems`/`items`/`discountAmount`/`cgstPercent`/`sgstPercent` from the store directly and calls `calculateExchangeApplied()` itself - same self-contained pattern `TotalsPanel` already uses, not props threaded down from `billing/page.tsx`. Renders only when `excessAmount > 0`.

Fields: a read-only "Refund amount: ₹X" (always `excessAmount`, live), a mode select (Cash/UPI/Bank Transfer, no pre-selected default), optional reference/UTR text input, optional remarks text input, and a confirmation checkbox. A non-blocking hint reminds that mode + confirmation will be required before this can actually be finalized (Step 5) - not enforced yet, since nothing submits in this phase either way.

### `billing/page.tsx` change

The Step 3 placeholder note ("Old jewellery exceeds this bill by ₹X - refund/credit choice arrives in a later update") is **replaced** by `<RefundSection />` - Step 4 is literally building the thing that note was foreshadowing, so the throwaway text goes away once the real form exists.

### Scenario table

| # | Scenario | Behavior |
|---|---|---|
| 1 | Excess appears for the first time (old jewellery total newly exceeds grand total) | `RefundSection` mounts, shows `excessAmount`, mode/reference/remarks/confirmed all at their defaults |
| 2 | Admin fills in mode + reference + remarks, then edits an old item (via the modal) so `excessAmount` changes | Displayed refund amount updates live (re-derived, not stored) - mode/reference/remarks/confirmed stay exactly as entered, since those are independent of the amount |
| 3 | Admin removes enough old items that `excessAmount` drops to 0 | `RefundSection` unmounts (stops rendering) - the draft `mode`/`reference`/`remarks`/`confirmed` values remain in the store but are inert and unused while excess is 0 |
| 4 | Excess returns later (admin adds items again, pushing total back past the bill) | `RefundSection` remounts, showing whatever `mode`/`reference`/`remarks` were left over from before - deliberately not auto-cleared (see below) |
| 5 | Admin changes nothing about old jewellery, just types in the Payment panel (cash amount) | No interaction at all - confirmed independent of refund, since `remainingBeforePayment` is already 0 whenever excess exists |
| 6 | `reset()` after a (hypothetical, still-blocked) successful sale | `refund` restored to its default, same as every other store field |
| 7 | Mode never selected, confirmation never checked | Finalize is irrelevant here regardless - still blocked by Step 3's unconditional gate, so there's nothing to leak through unvalidated |

**On scenario 3/4's "not auto-cleared" choice**: the alternative - automatically wiping `mode`/`reference`/`remarks` the instant `excessAmount` touches `0` - was considered and rejected. It adds a reactive side-effect into the store (a new class of state-management bug surface) to guard against a scenario that's already harmless: an unused, stale draft sitting in memory that nothing reads while `excessAmount` is `0`, and that the admin can simply review again before Step 5 ever makes it submittable. Keeping the store simple here was judged safer than adding auto-reset logic whose own correctness would need verifying.

---

## Step 5 — Backend transaction + validation wiring (technical plan)

This is the highest-risk step so far - it's the first one that touches the `createInvoice` function every single existing sale already goes through, not just new conditional code paths. The analysis below was done by reading the actual current code, not by assumption, specifically to answer "what else does this touch."

### Verified impact analysis

**Checked and confirmed genuinely unaffected:**
- **Dashboard** (`dashboardService.ts`) - every aggregate (`total_sales`, `pending_amount`, sales trend) sums `grandTotal` or `pendingAmount`, never `paidAmount`. `grandTotal` is never changed by exchange (guiding principle 2) and `pendingAmount` is already correctly exchange-aware since Step 3. Confirmed by reading every aggregation pipeline in the file - zero changes needed.
- **Invoice list/grid status badges** (`InvoiceTable.tsx`, `InvoiceGrid.tsx`) - render directly from `payment_status`, no separate derivation from `paid_amount` that could disagree with it. An exchange-settled invoice (`paid_amount: 0`, `payment_status: "paid"`) will correctly show a "Paid" badge with no changes needed.
- **`PrintInvoice.tsx` / payment receipt page** - display `invoice.paid_amount`/`invoice.pending_amount` directly from the server response, no local recomputation. Once the backend persists correct values, these pages are correct for free.
- **`createInvoice`'s existing callers** - the function signature (`CreateInvoiceInput → InvoiceDocument`) doesn't change, only the input schema grows with optional/defaulted fields. The one caller (`POST /api/invoices`) needs no call-site changes beyond what's already planned.
- **`serializeInvoice`'s existing consumers** - adding fields to its output is additive; nothing reads this response with strict/exact-shape validation that would reject extra fields.

**Found during this analysis, not previously scoped - a real bug that must be fixed here, not deferred:**
`addPayment()`'s safety check is `input.paid_amount > invoice.grandTotal` - it has no concept of `exchangeApplied` at all. The moment a real exchange-settled invoice exists (e.g. `grandTotal: 100000, exchangeApplied: 100000, pendingAmount: 0`), this check would still allow collecting up to the **full** ₹1,00,000 in cash on top of the exchange, because it only compares against the raw grand total. That's a real over-collection bug, not a cosmetic gap - it has to be fixed as part of this step, since it's Step 5 that first makes real exchange-settled invoices possible. Fix: `input.paid_amount > invoice.grandTotal - invoice.exchangeApplied`.

That fix has one dependency: `invoices/[id]/page.tsx`'s Collect Payment flow needs `invoice.exchange_applied` to compute its own cap correctly (it currently passes `0, 0` placeholders from Step 3, since `InvoiceDetail` doesn't carry the field yet). So this step also pulls forward the minimum needed to make that correct - not the full settlement-breakdown display (that's still Step 6), just the one field required for the payment cap to behave safely.

### New model field (small, same low-risk pattern as Step 1)

`Invoice.operationId: string | null`, sparse unique index - the idempotency key. Sparse so ordinary invoices (which won't set this - see scoping decision below) don't collide with each other via `null` uniqueness.

### Idempotency scoping decision

Given the explicit instruction to not impact anything else: idempotency enforcement is scoped to **only** the exchange path (`old_jewellery_items.length > 0`), not retrofitted onto ordinary sales. `operation_id` is accepted but optional in the schema, and the service layer only performs the duplicate-check when old jewellery items are present. This means the ordinary-sale code path executes exactly as it does today, byte-for-byte - the idempotency gap for plain sales (which does genuinely exist, noted back in the original Phase 1 plan) stays a separate, explicitly out-of-scope follow-up rather than being silently bundled into this change.

### Zod schema additions (`invoice.schema.ts`)

```ts
const oldJewelleryItemInputSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  metal: z.string().trim().min(1, "Metal is required"),
  purity: z.string().trim(),  // optional end-to-end, same as new-jewellery items
  gross_wt_g: z.number().positive("Gross weight is required"),
  stone_wt_g: z.number().min(0).default(0),
  dust_wt_g: z.number().min(0).default(0),
  other_deduction_wt_g: z.number().min(0).default(0),
  net_wt_g: z.number().min(0),
  default_rate_per_gram: z.number().min(0).nullable(),
  applied_rate_per_gram: z.number().positive("Rate is required"),
  calculated_value: z.number().min(0),
  final_value: z.number().min(0),
  override_reason: z.string().trim().optional(),
}).refine(
  (item) => item.stone_wt_g + item.dust_wt_g + item.other_deduction_wt_g <= item.gross_wt_g,
  { message: "Deductions cannot exceed gross weight", path: ["gross_wt_g"] },
);
```

On `createInvoiceSchema`:
```ts
old_jewellery_items: z.array(oldJewelleryItemInputSchema).default([]),
excess_settlement: z.enum(["refund"]).nullable().default(null),  // only "refund" exists until the Credit phase
refund: z.object({
  amount: z.number().positive(),
  mode: z.enum(["cash", "upi", "bank_transfer"]),  // matches RefundMode, no "card"
  reference: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
}).optional(),
operation_id: z.string().uuid().optional(),  // see idempotency scoping above
```
New `.refine()`s, same style as the existing `grand_total`/`cgst_amount` checks:
- If `sum(old_jewellery_items[].final_value) > grand_total`: `excess_settlement` must be `"refund"`, `refund` must be present, and `refund.amount` must match the excess within ₹1 (the confirmed "exact match only" rule).
- If `sum(...) <= grand_total`: `excess_settlement` must be `null` and `refund` absent - defensive, shouldn't be reachable from the UI (Step 4 only renders the refund form when excess is positive).

### Service layer (`invoicesService.ts`)

New typed errors, same pattern as `TagNotFoundError`:
```ts
export class RefundMismatchError extends Error { ... }
```
Duplicate submissions aren't an error at all - see the idempotency step below, which returns the original result instead of throwing.

`createInvoice`'s transaction, with new steps inserted around the existing ones **without reordering anything that already works**:
1. *(new, exchange-only)* If `old_jewellery_items.length > 0` and `operation_id` is present: look up an existing `Invoice` with that `operationId`. If found, return it immediately - a successful replay, not an error.
2. Tag checks - **existing, unchanged, same position**.
3. *(new, exchange-only)* Server computes `exchangeApplied`/`excessAmount` itself from `old_jewellery_items[].final_value` and the already-validated `grand_total` - the one deliberate exception to "trust the client's math," per decision 20. Verifies `refund.amount` matches `excessAmount` (±₹1) if excess exists, throwing `RefundMismatchError` otherwise - the same check the Zod schema already made, done again here as defense in depth for the transaction itself.
4. `getNextInvoiceNumber` - **existing, unchanged**.
5. Customer upsert - **existing, unchanged**.
6. *(new, exchange-only)* Get the next purchase number (same atomic `$inc` pattern as step 4), create the `OldJewelleryPurchase` (`status: "active"`, `excessSettlement`, `refund`), then each `OldJewelleryItem` (`status: "IN_SHOP"`).
7. `InvoiceModel.create([...], { session })` - **existing call, extended** with `exchangeApplied`, `linkedOldPurchaseId`, `linkedOldPurchaseNo`, `operationId` (all `0`/`null` when there's no exchange - this is the regression-safety path).
8. *(new, exchange-only)* If a purchase was created, update it with `linkedInvoiceId` now that the invoice id exists.

`addPayment()`: the fix described above - `input.paid_amount > invoice.grandTotal - invoice.exchangeApplied`. `PaymentExceedsBalanceError`'s message changes from "cannot exceed the invoice's grand total" to "cannot exceed the invoice's remaining balance" - still accurate when `exchangeApplied` is `0`, so this reads correctly for every existing/ordinary invoice too.

`serializeInvoice()`: add `exchange_applied`, `linked_old_purchase_id`, `linked_old_purchase_no` to the output (model fields already exist from Step 1).

### API route changes

`POST /api/invoices`:
```
422 - RefundMismatchError (new) - "Refund amount does not match the exchange excess"
200 - duplicate operation_id (new) - NOT an error; returns the original invoice_id/invoice_no unchanged
404/409 - TagNotFoundError/TagAlreadySoldError (existing, unchanged)
500 - anything else, logged (existing, unchanged)
```

`GET /api/invoices/:id` - `serializeInvoice`'s new fields flow through automatically (no route code change needed, it already calls `serializeInvoice`).

### Frontend changes

- `useInvoiceDetail.ts`'s `InvoiceDetail` type gains `exchange_applied: number` (and `linked_old_purchase_id`/`linked_old_purchase_no` for completeness, even though Step 6 is what actually displays them).
- `invoices/[id]/page.tsx`: `calculateNewPending(invoice.grand_total, invoice.exchange_applied, 0, newPaid)` replaces the Step 3 `0, 0` placeholder.
- `billing/page.tsx`'s `handleFinalize`: generates one `operation_id` (UUID) per Finalize click, sends `old_jewellery_items`/`excess_settlement`/`refund`/`operation_id` in the POST body when old jewellery items exist.
- `canFinalize`'s unconditional `oldJewelleryItems.length === 0` gate (Step 3) is replaced with real validation: every old jewellery item must be valid (description, gross weight, rate all present - mirroring `isItemValid`'s pattern for new items), and if `excessAmount > 0`, the refund draft must be complete (`mode` set, `confirmed` checked).

### Scenario table

| # | Scenario | Result |
|---|---|---|
| 1 | Ordinary sale, no old jewellery items | Every new step above is skipped (all gated on `old_jewellery_items.length > 0` or exchange-specific errors that can't fire) - byte-identical to today's `createInvoice` |
| 2 | Exchange sale, old jewellery < bill, no excess | Purchase + items created, `exchangeApplied` set on the invoice, no refund required, `excess_settlement`/`refund` both absent |
| 3 | Exchange sale, old jewellery = bill exactly | Same as #2, `exchangeApplied = grandTotal`, invoice fully settled |
| 4 | Exchange sale, old jewellery > bill (excess) | Refund amount cross-checked twice (Zod + transaction) against the server-computed excess; mismatch → `RefundMismatchError`, 422 |
| 5 | Double-click Finalize on an exchange sale | Second request's `operation_id` matches the first - returns the original `invoice_id`/`invoice_no`, no duplicate purchase/invoice/inventory created |
| 6 | Network retry of an exchange sale after a timeout | Same as #5 - same `operation_id` reused by the retry, not regenerated, so it's recognized as the same operation |
| 7 | Tag conflict (existing items) on a sale that also has an exchange | Tag check still runs first (step 2, unchanged position) - fails before any exchange-specific step runs, so no orphaned purchase/item records |
| 8 | Admin later collects payment on an exchange-settled invoice via Collect Payment | `remainingBeforePayment`/cap correctly reflects `grandTotal - exchangeApplied`, not the raw grand total - the bug found during this analysis, now fixed |
| 9 | Admin tries to collect more than the remaining balance on an exchange-settled invoice | `addPayment` rejects with `PaymentExceedsBalanceError` (422) - server-side safety net, independent of whatever the client computed |
| 10 | Old jewellery item has a rate of 0 (never filled in) | Blocked by the new `canFinalize` validation before submit, same proactive-gating convention as new-jewellery items |
| 11 | Transaction fails partway (e.g. DB connection drop after purchase creation, before invoice creation) | Whole transaction rolls back via `session.withTransaction` - no orphaned `OldJewelleryPurchase`/`OldJewelleryItem` left behind with no linked invoice |

---

## Step 6 — Settlement breakdown display + printable Old Jewellery Purchase Receipt (technical plan)

### Blast radius first

This is a lower-risk step than Step 5, confirmed by what it actually needs to touch - verified by reading the real files, not assuming:

- **Zero schema/model changes.** Every field this step displays (`exchangeApplied`, `linkedOldPurchaseId`/`No`, the full `OldJewelleryPurchase`/`OldJewelleryItem` data) was already built in Steps 1 and 5. This step only reads and formats, never writes.
- **Zero changes to `invoicesService.ts`'s write paths** (`createInvoice`, `addPayment`) - this step only touches `serializeInvoice`'s already-existing output (nothing new to add there, Step 5 already included `exchange_applied`/`linked_old_purchase_id`/`linked_old_purchase_no`) and adds one brand-new, fully separate read-only service file.
- **The new Old Jewellery Purchase Receipt is entirely new files** - new service, new API route, new hook, new print component, new page route. Nothing existing is modified to build it, so it carries zero regression risk to anything already working.
- **The only two existing files touched are additive and gated**: `invoices/[id]/page.tsx`'s Totals `<dl>` and `PrintInvoice.tsx`'s Payment Summary box both gain one new row, each wrapped in `invoice.exchange_applied > 0 ? ... : null`. For the overwhelming majority of invoices (no exchange), both render exactly as they do today - confirmed by inspecting the exact insertion points in both files.

### Scope decisions made while writing this plan

1. **The new receipt is print-only, no separate interactive detail page.** Mirrors the existing precedent for a single-payment receipt (`/invoices/[id]/payments/[index]/receipt`), which also has no separate detail view - just a direct print page. A full "Old Purchases" management page is the deferred standalone-purchase phase's job, not this one.
2. **One new API route, not two.** The existing invoice pattern has both `/api/invoices/:id` and `/api/invoices/:id/print` returning identical data via the same `serializeInvoice()`, kept separate "to match REQUIREMENTS.md's endpoint list" per that file's own comment. Since the new receipt has only one consumer (the print page), it gets only `GET /api/old-purchases/:id` - building an unused second route "for symmetry" would be infrastructure nobody calls.
3. **English-only for the new receipt, not bilingual.** `PrintInvoice.tsx`'s EN/HI toggle is specific to that one document and its `invoicePrintLocale.ts` file; nothing requires every print document in the app to support both languages. The **existing** invoice print page's new "Exchange Applied" row still must be bilingual, though, since it's a new row inside an already-bilingual component - leaving its Hindi label out would show broken/undefined text when Hindi is selected.
4. **No change to the invoices list page.** Flagged as optional in the earlier "what's in next phase" answer; nothing since then asked for it, so it stays out.

### New files (Old Jewellery Purchase Receipt)

- `src/server/services/oldJewelleryPurchasesService.ts` - `findOldJewelleryPurchaseById(id)` (same `Types.ObjectId.isValid` → `null` → clean 404 convention as `findInvoiceById`, not a 500 on a malformed id), fetching the purchase plus its items (`OldJewelleryItemModel.find({ purchaseId }).sort({ srNo: 1 })`); `serializeOldJewelleryPurchase(purchase, items)` bundling items directly into the response, same convention `serializeInvoice` already uses.
- `src/app/api/old-purchases/[id]/route.ts` - `GET`, `requireAuth` → `dbConnect` → service → `404` on `null` → `serializeOldJewelleryPurchase`. No typed errors needed beyond the 404 case - this is a pure read.
- `src/features/dashboard/hooks/useOldPurchaseDetail.ts` - one hook, mirroring `useInvoiceDetail`'s shape, typed against the new serialized response.
- `src/features/billing/components/PrintOldJewelleryPurchase.tsx` - purchase reference/date, customer, an items table (description, metal, purity, gross/stone/dust/other-deduction weights, net weight, rate, value - same field set as the billing-page entry table), total purchase value, amount applied to the invoice, excess amount, and (when `excessSettlement === "refund"`) the refund mode/reference/remarks. Links back to the originating invoice via `linkedInvoiceId`/`linkedInvoiceNo` equivalent fields. English-only, per the scope decision above.
- `src/app/(app)/old-purchases/[id]/print/page.tsx` - thin client wrapper, mirroring `invoices/[id]/print/page.tsx` exactly (`useParams` → render the print component with just the id).

### Changes to existing files (both additive, both gated)

**`invoices/[id]/page.tsx`** - in the Totals `<dl>`, between the existing Grand Total row and the Paid row:
```tsx
{invoice.exchange_applied > 0 ? (
  <div className="flex justify-between">
    <dt className="text-muted-foreground">Exchange Applied</dt>
    <dd className="text-foreground">− {formatInr(invoice.exchange_applied)}</dd>
  </div>
) : null}
```
Plus, when `invoice.linked_old_purchase_id` is present, a link/button opening `/old-purchases/{invoice.linked_old_purchase_id}/print` in a new tab - same `window.open(...)` pattern the existing "Print receipt for this payment" button already uses.

**`PrintInvoice.tsx`** - one new row in the Payment Summary box, between Amount Paid and Balance Due, gated the same way. Requires adding `exchangeApplied: string` to `InvoicePrintLabels` (`invoicePrintLocale.ts`) with both an `en` ("Exchange Applied") and `hi` ("विनिमय लागू") value - the interface is fully typed, so TypeScript itself would catch a missing key in either language object if this were forgotten.

### Scenario table

| # | Scenario | Result |
|---|---|---|
| 1 | Ordinary invoice, no exchange | Both new rows (`invoices/[id]/page.tsx`, `PrintInvoice.tsx`) render nothing - gated on `exchange_applied > 0`, confirmed by reading the exact conditional |
| 2 | Exchange-settled invoice, viewed on the detail page | "Exchange Applied" row shows, with a working link to the purchase receipt |
| 3 | Exchange-settled invoice, printed | Same row appears on the physical/PDF receipt, correctly labeled in whichever of EN/HI is selected |
| 4 | Purchase receipt requested for a non-existent or malformed id | Clean 404, same `findInvoiceById`-style convention, never a 500 `CastError` |
| 5 | Purchase with excess, settled by refund | Receipt shows the refund mode/reference/remarks; a purchase with no excess shows no refund section at all |
| 6 | Purchase receipt reprinted multiple times | Pure read, no state change - reprinting never creates/duplicates anything, same principle already established for invoice/payment receipts |
| 7 | Old jewellery item printed with an overridden `final_value` | Receipt shows the final value as stored; `override_reason`, if present, is shown as supporting detail |

### What's left unverifiable without a browser

Print-page layout (whether the new row causes any visual overflow on the fixed-width A4 print layout) can't be confirmed by typecheck/lint/build alone - worth a quick visual check once built, same limitation flagged for every other UI piece in this project so far.

---

## Step 7 — Inventory status management (technical plan)

### Blast radius first

Low-risk, confirmed by what it actually touches: a status-only mutation on `OldJewelleryItem` that no money-math code anywhere reads (`exchangeApplied`, `grandTotal`, `pendingAmount` etc. never look at item `status`), plus entirely new, isolated pages. Nothing existing gets modified except one small model correction below.

### A model gap found while planning, same class as Step 5's `createdBy` fix

`OldJewelleryStatusChange.changedBy` is currently `required: true` (`Types.ObjectId`, Step 1). Same architectural gap as `OldJewelleryPurchase.createdBy` had before Step 5 - no route in this app threads the authenticated admin's user id through to a service-layer write, so this field can never actually be populated with a real value. Fixing it the same way: `Types.ObjectId | null`, `default: null`. Not re-opening the `requireAuth()` scope question Step 5 already settled - same answer applies here.

### Where this lives - a real admin page, not just a list

The business doc's own UI expectations include a dedicated "Old Jewellery Inventory page" (§14) - without one, there's nowhere for an admin to see everything currently in the shop across every purchase, which is the actual point of a status change ("what can I melt today"), not just item-by-item from inside a specific invoice. The existing `invoices/[id]/page.tsx` old-items grid (Step 6 follow-up) stays read-only, scoped to one invoice's items - this phase adds the first real cross-purchase view.

### New files

**Backend** (added to the existing `oldJewelleryPurchasesService.ts`, not a new service file - small enough to not warrant splitting):
- `listOldJewelleryItems({ status?, page, limit })` - `OldJewelleryItemModel.find(filter).populate("purchaseId", "purchaseNo")`, newest first. `.populate()` is an established pattern in this codebase already (`tagsService.ts` uses it for `purityId`), not a new one introduced here.
- `changeOldJewelleryItemStatus(id, { status, reason })` - loads the item, 404 if missing (`OldJewelleryItemNotFoundError`), rejects if current status isn't `IN_SHOP` (`InvalidStatusTransitionError`, 409) - per decision 20/13.1, the only legal transitions are `IN_SHOP → DISPOSED` and `IN_SHOP → MELTED`, never reverting and never crossing between the two terminal states directly. Pushes a `statusHistory` entry (`from`, `to`, `reason`, `changedBy: null`, `changedAt: now`) and updates `status` in one `save()`.

**Zod schema**: `changeOldJewelleryItemStatusSchema = z.object({ status: z.enum(["DISPOSED", "MELTED"]), reason: z.string().trim().min(1, "A reason is required") })`.

**API routes**:
- `GET /api/old-items` - list, optional `?status=` filter, same `requireAuth` → `dbConnect` → service → serialize convention as every other route.
- `PATCH /api/old-items/:id/status` - change status. Error mapping: `OldJewelleryItemNotFoundError` → 404, `InvalidStatusTransitionError` → 409, Zod failure → 422 (`validationErrorResponse`).

**Frontend**:
- `useOldJewelleryItems.ts` - list hook (mirrors `useInvoicesList`'s shape) + `useChangeOldJewelleryItemStatus` mutation hook, invalidating the list query on success.
- `ChangeItemStatusDialog.tsx` - pick Disposed or Melted, a required reason field, Confirm/Cancel. Mirrors `AddOldJewelleryItemDialog`'s no-`open`-prop, mount-only-while-active convention.
- `/old-inventory` page - ag-grid: Purchase No, Description, Metal, Purity, Net Wt, Value, Status (badge, same color convention as invoice status badges), Action column (the dialog trigger, only rendered when `status === "IN_SHOP"` - already-`DISPOSED`/`MELTED` rows show the badge with no action, matching the "no reverting" rule visually, not just server-side).
- One new `Sidebar.tsx` nav entry (`"Old Jewellery"`, `/old-inventory`) - the only existing file this phase touches at all, a one-line addition to the existing flat nav array.

### Scenario table

| # | Scenario | Result |
|---|---|---|
| 1 | Item is `IN_SHOP`, admin marks it `DISPOSED` with a reason | Status updates, one `statusHistory` entry appended, item disappears from any future "available stock" filtering (none exists yet to break, but the field is there for when it does) |
| 2 | Admin tries to change status on an already-`DISPOSED` item | Rejected, `InvalidStatusTransitionError`, 409 - action button isn't even rendered client-side for non-`IN_SHOP` rows, this is the server-side backstop |
| 3 | Admin tries to submit with no reason | Blocked client-side (required field) and server-side (Zod `min(1)`) |
| 4 | Admin filters the inventory list by status | `GET /api/old-items?status=IN_SHOP` (etc.) - straightforward query filter, no transaction involved |
| 5 | Item belongs to a `cancelled` purchase (future phase, not reachable yet) | Not a concern now - cancel-and-recreate is still deferred, `OldJewelleryPurchase.status` stays `"active"` for everything that exists today |
| 6 | Dashboard/invoice/payment math of any kind | Unaffected - confirmed nothing reads `OldJewelleryItem.status` anywhere in the settlement/payment code paths |

---

## Explicitly not in this phase

- Standalone Old Jewellery Purchase page.
- Customer Credit / wallet (balance, ledger, withdrawal, spending credit on a later bill, Customers-page credit column/filter).
- Reports/analytics (deferred in the source doc too, Decision 19 — not revisited here).
- Any change to existing sales-invoice item/GST/discount/grand-total math, or new-jewellery sales returns (both explicitly out of scope per the source doc's guiding principles).

---

## Customer Credit — built, then explicitly removed (24 Oct 2026)

A full Customer Credit implementation was built against the technical plan from `~/Downloads/Jewellery_Customer_Credit_Final_Updated.md` (new `CreditLedgerEntry` model, `Customer.creditBalance`/`Invoice.creditUsed` fields, `creditService.ts` with `grantCredit()`/`spendCredit()`/`withdrawCredit()`, a Refund-vs-Keep-as-Credit choice in both billing and the standalone purchase page, existing-balance usage on a new bill, Customers-page Available Credit column/Has Credit filter, and a customer-detail credit history + withdrawal dialog) — then the decision was made to **remove it entirely and keep Refund as the only excess-settlement option**.

**Removed in full:**
- `CreditLedgerEntry.model.ts`, `creditService.ts`, `credit.schema.ts`.
- `Customer.creditBalance`, `Invoice.creditUsed` fields.
- `GET /api/customers/:id/credit-ledger`, `POST /api/customers/:id/credit-withdrawals`.
- `CreditUsageSection.tsx`, `CreditHistorySection.tsx`, `WithdrawCreditDialog.tsx`.
- The Refund/Credit choice in billing and the standalone purchase page - `ExcessSettlementSection.tsx`/`StandaloneExcessSettlementSection.tsx` reverted back to their original refund-only `RefundSection.tsx`/`StandaloneRefundSection.tsx` versions.
- The Customers page's Available Credit column/Has Credit filter, and the customer detail page's credit stat card.
- `excess_settlement`'s `"credit"` value and `credit_used` from `invoice.schema.ts`/`standaloneOldJewelleryPurchase.schema.ts`; `createInvoice()`/`addPayment()`/`createStandaloneOldJewelleryPurchase()` reverted to their pre-Credit-Phase logic (hardcoded `"refund"`, no `creditUsed` subtraction).

Confirmed via `grep -rni credit src` that no stray references, and via `grep` for every removed symbol name (`CreditLedgerEntry`, `creditService`, `grantCredit`, `spendCredit`, `withdrawCredit`, `InsufficientCreditError`, `creditBalance`, `credit_balance`, `excessSettlementChoice`, `ExcessSettlementChoice`, `CreditUsageSection`, `ExcessSettlementSection`) that zero references remain anywhere in `src`. `tsc --noEmit`, `eslint`, and `next build` all pass clean after the removal. Steps 1-7 and the standalone purchase page (both built in earlier phases, sharing some of the same files) were preserved untouched throughout - only the Credit-specific additions were stripped back out.

**Current state: Refund is the only excess-settlement option**, in both billing and the standalone purchase page, exactly as it was before this phase began.
