# Billing Module — How It Works

> **This is a reference, not a history.** It describes the billing/invoicing module as it actually behaves right now (last verified 2026-10-22), so that a future change can be checked against the real current behavior instead of re-reading every file from scratch. For *why* things ended up this way — the decisions, the bugs that were found and fixed, the back-and-forth with the user — see `docs/billing-plan.md` (the build log) and the `billing_page_audit.md` memory file (the redesign history). If this file and the code ever disagree, the code is right — update this file, don't trust it blindly.

---

## 1. What this module does

Two things happen here:
- **`/billing`** — a point-of-sale screen. A cashier enters/looks up a customer, adds line items (by scanning a tag, browsing tags, or typing one in manually), sees live totals, optionally takes a payment, and finalizes the sale. Finalizing creates a permanent `Invoice` document, marks any scanned tags `sold`, and upserts the customer record.
- **`/invoices`** — the resulting ledger: a list page, a detail page (with "Collect Payment" for partial/unpaid invoices), a print/receipt page, and a per-payment receipt page.

## 2. File map

```
src/app/(app)/billing/page.tsx                 Billing page - assembles everything, owns Finalize
src/app/(app)/invoices/page.tsx                Ledger list page
src/app/(app)/invoices/[id]/page.tsx           Invoice detail + Collect Payment dialog
src/app/(app)/invoices/[id]/print/page.tsx     Full receipt (window.print())
src/app/(app)/invoices/[id]/payments/[index]/receipt/page.tsx   Single-payment slip

src/features/billing/components/
  CustomerFields.tsx      Phone/Name/Email/Address row + phone-lookup UX
  ItemTable.tsx            The items grid (ag-grid) + its header actions + the Add Item dialog
  ScanInput.tsx            "Scan or type tag code, press Enter"
  TagBrowseDialog.tsx      Searchable picker over already-tagged inventory
  TotalsPanel.tsx          Discount/GST inputs + Subtotal/GST/Grand Total summary
  PaymentPanel.tsx         Amount/Mode inputs, reused on the invoice detail page too
  NumberField.tsx          Shared text-based numeric input (see §7)

src/features/billing/hooks/
  useCustomerLookup.ts     GET /api/customers?phone= (debounced, exact match only)
  useAddTagItem.ts         Shared by ScanInput + TagBrowseDialog - fetch tag, fetch its rate, add to store
  useCreateInvoice.ts      POST /api/invoices
  useAddPayment.ts         POST /api/invoices/:id/payments

src/features/billing/lib/
  calculations.ts          calculateItemTotal / calculateInvoiceTotals / calculateNewPending
  itemValidity.ts          isItemValid() - the proactive "is this row postable" check
  numericInput.ts          sanitizeNumericInput / isValidNumericInput (leading-zero fix)
  useNumericStoreField.ts  Local-buffer hook for a numeric field backed by the Zustand store

src/store/useBillingStore.ts     The in-memory draft: customer, items[], discount, GST%, payment, errors

src/schemas/invoice.schema.ts    createInvoiceSchema, addInvoicePaymentSchema (Zod)
src/models/Invoice.model.ts      InvoiceDocument / InvoiceItem Mongoose schema
src/models/InvoiceCounter.model.ts   Atomic per-year invoice-number ticket dispenser
src/server/services/invoicesService.ts   All the business logic (see §6)
src/lib/business-time.ts         businessDayStart/End - IST (+05:30) day boundaries, shared with dashboard

src/app/api/invoices/route.ts                  GET (list), POST (create)
src/app/api/invoices/[id]/route.ts             GET (detail), DELETE (cascade, no UI entry point)
src/app/api/invoices/[id]/payments/route.ts    POST (add payment)
src/app/api/invoices/[id]/print/route.ts       GET (same data as detail)
```

## 3. The billing page's data flow

```
useBillingStore (Zustand, in-memory, not persisted)
  customer, items[], discountAmount, gstPercent, payment, fieldErrors, itemErrors
        │
        ├─ every addItem/updateItem derives `total` via calculations.ts
        │  (never trusts a passed-in total - see §4)
        │
  billing/page.tsx reads the store, computes:
        totals = calculateInvoiceTotals(items, discountAmount, gstPercent)
        { pendingAmount, paymentStatus } = calculateNewPending(totals.grandTotal, payment?.amount)
        canFinalize = customer.name && customer.phone && items.length > 0
                      && items.every(isItemValid) && !createInvoice.isPending
        │
  "Finalize Sale" clicked → handleFinalize():
        1. builds the exact POST body from store + totals (same numbers shown on screen)
        2. createInvoiceSchema.safeParse(body) - CLIENT-SIDE, full precision
           → any issue populates fieldErrors/itemErrors in the store, blocks submit, shows toast
        3. if clean: createInvoice.mutate(body) → POST /api/invoices
        4. on success: confirmation screen (Print Receipt / New Sale), store reset()
        5. on error (404/409 tag conflict, or unexpected): toast with the real reason
```

**Why the client re-runs the full Zod schema before submitting**: the server's 422 response only ever carries one flattened message per *top-level* field (`"customer"` or `"items"` as a whole - `src/server/validation.ts`'s `flattenError()` collapses everything). Running `createInvoiceSchema.safeParse()` client-side first gives the real per-issue path (e.g. `["items", 2, "rate_per_gram"]`), which is what lets a specific grid cell on a specific row turn red instead of a generic "Validation failed" toast.

## 4. Calculation formulas (the money math — single source of truth)

All three functions live in `src/features/billing/lib/calculations.ts` and are called from exactly three places: the store's `withTotal` (every add/edit), `TotalsPanel` (live display), and `billing/page.tsx`'s submit body. **They must never be reimplemented anywhere else** - that's what guarantees the displayed number and the submitted number can never disagree.

```
calculateItemTotal({ netWtG, ratePerGram, makingCharge, stoneCharge, pieces }):
  metalValue    = round(netWtG × ratePerGram)
  perPieceTotal = metalValue + round(makingCharge) + round(stoneCharge)
  total         = perPieceTotal × pieces

  // netWtG/ratePerGram/makingCharge/stoneCharge are all PER-PIECE figures.
  // A line with pieces=5 is priced as one piece's math, then × 5.

calculateInvoiceTotals(items, discountAmount, gstPercent):
  subtotal      = Σ item.total
  safeDiscount  = min(discountAmount, subtotal)      // never lets discount go negative
  taxableAmount = max(0, subtotal − safeDiscount)
  gstAmount     = round(taxableAmount × gstPercent / 100, 2dp)
  grandTotal    = round(taxableAmount + gstAmount)   // whole rupee

calculateNewPending(grandTotal, paidAmount):
  pendingAmount = max(0, grandTotal − paidAmount)
  paymentStatus = paidAmount >= grandTotal ? "paid"
                : paidAmount > 0           ? "partial"
                :                            "unpaid"
```

The server (`createInvoiceSchema`) **never recomputes** any of this. It only does a loose ₹1-tolerance sanity check: `|grand_total − (subtotal − discount_amount + gst_amount)| <= 1`. This is deliberate (`docs/billing-plan.md` decision 7) — flagged there as an accepted risk, not something to silently "fix" by adding server-side recomputation.

## 5. Validation — what's required, and where it's checked

Two layers, same schema, different strictness:

| Field | Required by schema (`invoice.schema.ts` + `Invoice.model.ts`) | Proactively gated client-side (`isItemValid`/`getLiveItemErrors`, red while typing, blocks Finalize) |
|---|---|---|
| `customer.name`, `customer.phone` | ✅ | ✅ (checked directly in `canFinalize`) |
| `customer.email` | valid format if present, else optional | — |
| item `description` | ✅ non-empty | ✅ |
| item `gross_wt_g` | ✅ `> 0` | ✅ |
| item `net_wt_g` | ✅ `> 0` | ✅ |
| item `rate_per_gram` | ✅ `> 0` | ✅ |
| item `pieces` | ✅ positive integer | ✅ (added when Pieces started multiplying into the total - see §4) |
| item `hsn_code` | ✅ non-empty | ❌ — deliberate: already required server-side, left ungated client-side by explicit product decision |
| item `purity` | ❌ **not required at all** (explicit decision, see below) | ❌ |
| item `stone_wt_g`, `making_charge`, `stone_charge` | `>= 0` only (0 is valid) | — |
| item `tag_code` | optional, uppercased if present | — |
| `discount_amount`, `gst_percent`, `payment.*`, `paid_amount` | various `>= 0` / range checks | partially (discount/GST/payment show their own field errors on submit) |

**Purity is intentionally fully optional, end-to-end**, as of 2026-10-22. `purity: z.string().trim()` (no `.min(1)`) in the schema, `{ type: String, default: "" }` (no `required: true`) in the Mongoose model. This was a deliberate, explicit decision after the user was directly asked about the GST/BIS-hallmarking compliance angle and chose to proceed anyway — **don't silently re-add this requirement**; if it ever needs to come back, that's a product decision to confirm again, not a "fix." Purity is also not auto-selected anymore when adding a manual item (no first-purity-in-the-list pre-fill) — the `<Select>` has a real "Select purity" placeholder option, and switching Metal resets both purity and rate to blank/zero rather than leaving a stale value from the previous metal.

Cross-field checks (`createInvoiceSchema`'s `.refine()`s, server + client both run the same ones): `paid_amount <= grand_total`; the ₹1-tolerance grand-total sanity check above; no duplicate `tag_code` within one invoice's `items[]` (tag codes compared case-insensitively everywhere in this app — the Tag model stores uppercase, lookups uppercase, and `useBillingStore`'s client-side `hasTag()` guard also uppercases both sides before comparing, so a second scan of the same tag in a different case is caught before it ever reaches the schema).

## 6. Backend service logic (`invoicesService.ts`)

**`createInvoice(input)`** — one Mongoose transaction (`session.withTransaction`, which auto-retries on the driver's `TransientTransactionError` label but propagates the service's own typed errors immediately):
1. Collect unique `tag_code`s from `items[]`.
2. Inside the session: find those tags, 404 (`TagNotFoundError`) if any code doesn't resolve, 409 (`TagAlreadySoldError`) if any resolved tag's `status !== "tagged"` — both errors list **every** conflicting code, not just the first.
3. Mark those tags `sold`.
4. Atomically increment that calendar year's counter (`InvoiceCounterModel`) → `INV-{year}-{4-digit-padded}`.
5. Upsert the customer by `phone` — **overwrites name/email/address every time**, no diff-check (`docs/billing-plan.md` decision 3). `$set` skips `undefined` fields, so omitting email/address on this sale leaves a previously-stored value untouched rather than blanking it.
6. Insert the `Invoice` document (items get server-assigned `srNo = index + 1`, never trusted from the client).

**`listInvoices({page, limit, date, customerId})`** — `date` (if given) filters `createdAt` using IST day boundaries (`businessDayStart`/`businessDayEnd` from `src/lib/business-time.ts`, `+05:30` fixed offset — not UTC. This was a real bug: before this fix, an invoice created between midnight and 5:30am IST could be stamped with the *previous* UTC calendar date and silently miss "today"'s filter).

**`addPayment(id, input)`** — loads the invoice, rejects (`PaymentExceedsBalanceError`, 422) if the resent `paid_amount > grandTotal`, pushes to `payments[]`, then **trusts the client-resent `paid_amount`/`pending_amount`/`payment_status`** rather than recomputing them server-side (same "client-side authoritative math" rule as invoice creation).

**`deleteInvoiceCascade(id)`** — its own transaction: revert any linked tags back to `tagged`, then delete the invoice. **Built, but has no button or entry point anywhere in the UI** — reachable only by calling `DELETE /api/invoices/:id` directly.

**`findInvoiceById(id)`** — returns `null` (not a thrown `CastError`) for a malformed id, so every caller gets a clean 404 instead of a 500.

## 7. Frontend details worth knowing before touching this code

- **Row mutation in the items grid is positional, not by id.** `ItemTable.tsx`'s cell editors and remove button are keyed by `node.rowIndex` (the grid's rendered row position), which is only safe because `AG_GRID_DEFAULT_COL_DEF` disables sorting/filtering and the grid's row order always equals the store's `items` array order. **If this table ever gains sorting, or gets replaced, every edit/remove action must be re-keyed to the item's stable `id` field instead of index**, or clicks will silently land on the wrong row.
- **Numeric inputs are `type="text"` + `inputMode="decimal"`, never `type="number"`.** A real, screenshot-confirmed bug: React's controlled-input diffing can leave a literal `"011"` stuck on screen for a number input even though the underlying value is correctly `11`. Fixed via `numericInput.ts`'s sanitize functions, `NumberField.tsx` (for bordered inputs) and `useNumericStoreField.ts` (for numeric fields backed directly by the Zustand store, so a local display buffer survives mid-typing states like `"0."` that `Number()` would otherwise collapse).
- **Net weight auto-derives from `gross − stone`** (`max(0, gross - stone)`, rounded to 3dp — not 2, since gross/stone are routinely entered to milligram precision). This happens in both `ManualAddForm` and the grid's `handleFieldChange`, and **overwrites a manually-typed net weight** whenever gross or stone changes afterward. Explicit product decision, not a bug.
- **`PaymentPanel`'s `bare` prop controls only the outer panel/heading wrapper.** It used to also silently flip the "Pay in full"/"Pay remaining" button label and hide a hint line, because its one pre-existing caller (the invoice detail page's Collect Payment dialog) happened to want both changes bundled together. Now decoupled into separate `payButtonLabel` (default `"Pay full amount"`) and `showHint` (default `!bare`) props, so a second caller with different label/hint needs doesn't silently inherit the first caller's assumptions.
- **`TotalsPanel` shows a hint, not just a different number, when discount gets clamped.** `calculateInvoiceTotals` clamps `discountAmount` to the subtotal; if the raw typed value exceeds it, the Discount field now shows "Capped at the subtotal, ₹X" instead of just silently disagreeing with the summary below it.
- **Layout** (as of the 2026-10-22 redesign): a single full-width column — Customer panel (one row: Phone/Name/Email/Address) → Items panel (header holds the scan input + Browse Tags + Add Item, not a separate panel) → one combined "Totals & Payment" panel. No more sidebar split. The items grid has 13 columns: SR (implicit row order) is not shown as its own column; visible columns are Description, HSN, Tag, Metal, Purity, Pcs, Gross Wt, Stone Wt, Net Wt, Rate/g, Making Charge, Stone Charge, Total, plus a remove-row action column.

## 8. API summary

| Method & path | Auth | Request | Success | Known error responses |
|---|---|---|---|---|
| `GET /api/invoices` | ✅ | `?page&limit&date&customerId` | `200 {data, total, page}` | — |
| `POST /api/invoices` | ✅ | `createInvoiceSchema` body | `201 {invoice_id, invoice_no, created_at}` | `422` validation, `404` unknown tag code(s) (`{error, codes}`), `409` already-sold tag code(s) (`{error, codes}`) |
| `GET /api/invoices/:id` | ✅ | — | `200` full `serializeInvoice()` shape | `404` |
| `DELETE /api/invoices/:id` | ✅ | — | `200 {message, reverted_tags}` | `404` — **no UI button calls this** |
| `GET /api/invoices/:id/print` | ✅ | — | same shape as detail | `404` |
| `POST /api/invoices/:id/payments` | ✅ | `addInvoicePaymentSchema` body | `200 {invoice_id, saved: true}` | `422` (bad body, or `paid_amount > grand_total`), `404` |

All routes: `requireAuth()` → `dbConnect()` → validate → service, same convention as every other route in this app. None of them set `runtime: "edge"` (transactions require the Node.js runtime).

## 9. Deliberate, non-obvious decisions (don't "fix" these without confirming first)

- Backend never recomputes GST/pricing math — only loose sanity bounds. (§4, §6)
- Purity is fully optional end-to-end, after an explicit compliance question was put to the user. (§5)
- `hsn_code` and `metal` are required server-side but **not** proactively gated client-side (purity now matches this too).
- Stone weight / making charge / stone charge default to `0` and `0` is a *valid* value for them — unlike gross/net weight and rate, where `0` means "not really entered."
- `DELETE /api/invoices/:id` exists and works but is intentionally unreachable from the UI.
- Day-boundary filtering (`listInvoices`'s `date` param, and the Dashboard's range queries) uses a hardcoded `+05:30` offset, not the server process's local timezone — see `src/lib/business-time.ts`'s own comment for why relying on server/process local time would be fragile across deployments.
