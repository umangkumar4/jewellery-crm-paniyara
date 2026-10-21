# Billing / Invoices Module — Implementation Plan

> **Status: two model files built (`Invoice.model.ts`, `InvoiceCounter.model.ts`); everything else below is planned, not yet built.** This doc exists for the same reason `metal-rates-plan.md` does — the design was worked out through extended discussion before writing code, because this is the single most financially consequential module in the app (it moves inventory to `sold` and creates the permanent sales record). Capturing every decision here means we don't have to re-litigate any of it mid-implementation.
>
> Base spec: `REQUIREMENTS.md §4.3` (endpoints 7–13), `DATABASE_DESIGN.md §2.5/§2.6/§3`, `bckend_setup.md` (invoices rows in the route table + business rules), `frontend_setup.md §4–§6` (calculations module, POS scan flow, printing). This doc only records what those specs left ambiguous or what was explicitly changed from them — it is not a restatement of the whole spec.

---

## Decisions made this session (the ambiguous parts of the spec, resolved)

1. **MongoDB replica-set conversion — done.** `POST /api/invoices` requires a multi-document Mongoose transaction (counter + tags + customer + invoice, all atomic). Verified by direct test that the local standalone `mongod` **could not run transactions at all** (`"This MongoDB deployment does not support retryable writes"`). Fixed by adding `replication.replSetName: rs0` to `/opt/homebrew/etc/mongod.conf`, restarting the service, and running `rs.initiate()` once. Re-verified with a real transactional write afterward — works. **No further action needed here**, but if this is ever deployed anywhere other than this laptop (a managed MongoDB Atlas cluster, a different machine), confirm the target is already a replica set — standalone deployments are a hard blocker for this entire module, not a performance tweak.
2. **Financial-year boundary for `INV-YYYY-XXXX` numbering: calendar year (Jan 1–Dec 31)**, not the Indian Apr–Mar fiscal year. `financialYear = new Date().getFullYear()` at the moment of creation (server clock), passed into the atomic counter increment.
3. **Customer upsert on invoice creation: overwrite every time**, keyed by `phone`. Editing an autofilled name/email/address in the POS form and finalizing the sale **permanently updates** that customer's master record for every future lookup — no diff-check, no confirmation step. This is what `REQUIREMENTS.md`/`DATABASE_DESIGN.md` already specified; the alternative (diff-only update, or locking the profile after first creation) was considered and explicitly rejected.
4. **`POST /api/invoices/:id/payments` trusts the client-resent `paid_amount`/`pending_amount`/`payment_status`** rather than the server recomputing them from the existing total + new payment amount — consistent with the rest of this module's "client-side authoritative math" rule (point 7 below), applied uniformly even though this particular case is simple addition the server safely could have computed itself.
5. **`DELETE /api/invoices/:id` is built on the backend but intentionally has no button/entry point anywhere in the UI.** Wrapped in its own Mongoose transaction (revert tags + delete invoice together) even though `DATABASE_DESIGN.md §3` doesn't explicitly mandate a transaction for delete the way it does for creation — this avoids a crash between "tags reverted" and "invoice deleted" leaving an inconsistent state.
6. **A loose sanity check on invoice creation**: reject (`422`) if `|grand_total - (subtotal - discount_amount + gst_amount)| > 1` (₹1 tolerance for rounding). This is **not** a recomputation of GST/pricing logic — it's a guard against an obviously broken or tampered payload, not a second implementation of the business math. See point 7 for what this deliberately does *not* cover.
7. **Backend does not recompute item/invoice totals.** Per `REQUIREMENTS.md §5` rule 1 and `bckend_setup.md` rule 5 ("client-side authoritative math"), `total` per item (`net_wt_g * rate_per_gram + making_charge + stone_charge`) and the GST/discount math are computed in `src/features/billing/lib/calculations.ts` on the client and trusted as submitted, structural validation only. **Flagged risk, accepted as an explicit pre-existing project decision, not something this implementation should quietly override**: a buggy or malicious client could submit a `grand_total` inconsistent with reality beyond the ₹1 tolerance band and it would be rejected — but within that band, or for item-level charge manipulation that still sums to a plausible grand total, the server will not catch it. Worth revisiting with the project owner at some point; out of scope for this implementation.
8. **Duplicate `tag_code` within one invoice's `items[]` is rejected before the transaction opens** (structural — one tag physically cannot be sold twice in one sale, this isn't "recalculating pricing").
9. **Line-item `sr_no` is never trusted from the client** — assigned server-side as `index + 1`, same spirit as tag codes being server-generated in `tagsService.ts`.
10. **Tag availability is re-checked inside the transaction session**, not before it opens. Checking before the transaction would create a race window where a second concurrent sale could grab the same tag between the check and the write; reading inside the session gives snapshot isolation against that.
11. **Frontend item entry gets three paths, not just the physical scanner** — added because there's no scanner gun available for testing right now, but kept permanently since it's strictly more capable than scanner-only:
    - **Enter Code** — a text input (barcode gun *or* manual typing, same `GET /api/tags/:code` lookup either way).
    - **Browse Tags** — new. A searchable dialog over the already-existing `GET /api/tags?q=&status=tagged&page=&limit=` (no new backend endpoint needed), for "I don't remember the exact code." Clicking a result re-fetches it via `GET /api/tags/:code` before adding (never trusts the possibly-stale list cache) — same 404/409 handling as Enter Code.
    - **Add Manually** — a custom line with no `tag_code` at all (for one-off items not in inventory), matching `tagCode?: string | null` already being optional in `Invoice.model.ts`.
    - All three land in the same editable `ItemTable.tsx` row afterward — every field stays editable except `tag_code` itself (changing which physical tag a line refers to is a remove-and-re-add, not an edit).
12. **Post-sale UX: confirmation screen with explicit Print / New Sale buttons** — no auto-redirect to the print page, no auto `window.print()`. A busy cashier should be able to start the next customer's lookup immediately without an interruption they didn't ask for.

---

## Data model (built — `src/models/Invoice.model.ts`, `src/models/InvoiceCounter.model.ts`)

```ts
// InvoiceCounter — a disposable atomic ticket-dispenser, nothing else
{ _id: number /* calendar year */, lastNumber: number }
```

```ts
// Invoice — the permanent financial record
{
  invoiceNo: string,              // unique, "INV-2026-0042"
  customerId: ObjectId,           // ref Customer
  customer: { name, phone, email?, address? },   // denormalized snapshot — never rewritten by later customer edits
  items: [{
    srNo, tagCode?, description, hsnCode, metal, purity, pieces,
    grossWtG, stoneWtG, netWtG, ratePerGram, makingCharge, stoneCharge, total,
  }],   // every field is a frozen snapshot, not a live reference — unlike Tag.purityId
  payments: [{ amount, mode, paidAt }],
  subtotal, discountAmount, gstPercent, gstAmount, grandTotal,
  paidAmount, pendingAmount, paymentStatus,
}  // + timestamps, index on createdAt desc
```

Both already pass `pnpm typecheck`/`pnpm lint`.

---

## Phases

Each phase should be fully typechecked, linted, and manually smoke-tested against the local MongoDB (now a working replica set) before moving to the next — this module is too consequential to batch verification at the end.

### Phase 0 — Infra ✅ done
- [x] Convert local MongoDB to a single-node replica set; verify a real transactional write succeeds.

### Phase 1 — Models ✅ done
- [x] `src/models/InvoiceCounter.model.ts`
- [x] `src/models/Invoice.model.ts`

### Phase 2 — Backend validation schema ✅ done
- [x] `src/schemas/invoice.schema.ts`:
  - `createInvoiceSchema` — full `POST /api/invoices` body (see Validation checklist below for every rule it must encode).
  - `addInvoicePaymentSchema` for `POST /api/invoices/:id/payments`'s body.
- [x] Embedded `customer` object given its own inline schema rather than reusing `customer.schema.ts` directly (that file's schema is shaped for the phone-lookup query param, not a full name/phone/email/address object) - matches `DATABASE_DESIGN.md`'s own embedded customer shape.

### Phase 3 — Backend service ✅ done
- [x] `src/server/services/invoicesService.ts`:
  - `getNextInvoiceNumber(year, session)` — atomic `$inc`, formats `INV-{year}-{padded4}`.
  - `createInvoice(input)` — the full transaction: validate tags (read, inside session) → mark sold (write) → increment counter (write) → upsert customer (write, overwrite) → insert invoice (write) → commit. Throws typed errors for tag-not-found / tag-already-sold (listing every conflicting code, not just the first).
  - `listInvoices({page, limit, date})` — paginated, no `.populate()` needed (customer is already embedded).
  - `findInvoiceById(id)`.
  - `deleteInvoiceCascade(id)` — own transaction: find → extract `tagCode`s → revert tags to `tagged` → delete invoice.
  - `addPayment(id, input)` — push to `payments[]`, trust client-resent aggregate fields (decision 4), still enforce `paid_amount <= grandTotal`.
  - `serializeInvoice()` / a lighter list-row serializer matching the `GET /api/invoices` response shape from `REQUIREMENTS.md`.
  - **Real bug found and fixed while verifying this phase**: `mongoose.startSession()` + manual `startTransaction()`/`commitTransaction()` failed on the very first write ever made to a brand-new collection (`invoices` didn't exist yet) with `"Unable to write to collection ... due to catalog changes; please retry the operation"` — a transient `WriteConflict` the driver labels `TransientTransactionError`. Reproduced live, then fixed by switching both `createInvoice()` and `deleteInvoiceCascade()` to `session.withTransaction(async () => {...})` (MongoDB's officially recommended pattern), which auto-retries the whole callback on that label but does **not** retry on our own thrown errors (`TagNotFoundError`/`TagAlreadySoldError`/`InvoiceNotFoundError` have no such label, so they abort and propagate immediately, exactly once). Re-verified end-to-end afterward: happy path, both tag-conflict error paths, counter correctly un-incremented on both failed attempts (proves rollback), overpayment rejection, valid payment append, and cascade delete (tag reverted, invoice removed, counter and customer left untouched) — all against the real local MongoDB, test data cleaned up after.
  - Minor, not fixed: `findOneAndUpdate(..., {new: true})` triggers a Mongoose deprecation warning (`returnDocument: "after"` is preferred) — left as-is since `metalPuritiesService.ts` already uses the same `{new: true}` option throughout; fixing it only here would make the codebase's style inconsistent rather than better. Worth a dedicated pass across all services if it's ever addressed.

### Phase 4 — Backend routes ✅ done
- [x] `src/app/api/invoices/route.ts` — `GET` (list), `POST` (create).
- [x] `src/app/api/invoices/[id]/route.ts` — `GET` (detail), `DELETE` (cascade — backend only, never linked from the UI).
- [x] `src/app/api/invoices/[id]/print/route.ts` — `GET` (same data as detail; the "print" distinction is a frontend layout concern, not a different query).
- [x] `src/app/api/invoices/[id]/payments/route.ts` — `POST`.
- [x] All routes: `requireAuth()` → `dbConnect()` → validate → service, same convention as every existing route. None set `runtime: "edge"`.
- Built and verified one file at a time, each fully smoke-tested against the local MongoDB before moving to the next (see Phase 5 below for exactly what was run) rather than batching verification to the end.

### Phase 5 — Backend verification ✅ done (this round)
- [x] `pnpm typecheck` / `pnpm lint` clean after every file.
- [x] Manual curl-based smoke test with a short-lived signed JWT, seeding a real tag/purity/customer and cleaning up afterward:
  - `POST /api/invoices`: `401` (no token), `422` (empty body — every required field surfaced), `201` happy path (`INV-2026-000N` format, correct response shape), `409` re-selling the same now-sold tag, `404` unknown tag code.
  - `GET /api/invoices`: correct `{data, total, page}` shape and row content.
  - `GET /api/invoices/:id`: `401`, `404` (malformed id *and* well-formed-but-nonexistent id — both guarded), `200` full detail matching `serializeInvoice()`.
  - `DELETE /api/invoices/:id`: `401`, `404` nonexistent, `200` happy path — confirmed the tag actually reverted to `tagged` in the DB (not just a 200 response) and the invoice really gone (follow-up `GET` returns `404`).
  - `GET /api/invoices/:id/print`: `401`, `404`, `200` — same shape as detail, confirmed separately rather than assumed.
  - `POST /api/invoices/:id/payments`: `401`, `422` (bad body), `404` (nonexistent invoice), `422` (`paid_amount > grand_total`), `200` happy path — confirmed via a follow-up `GET` detail that both payments landed in `payments[]` and the invoice correctly flipped to `paymentStatus: "paid"`, `pendingAmount: 0`.
  - All test data (tag, purity, customer, invoice) deleted after; dev server stopped afterward.
- [ ] Concurrency sanity check (two simultaneous create-invoice requests racing for the same tag) — **not yet run**, left for a dedicated pass since it needs two truly concurrent requests, not sequential curl calls.

### Phase 6 — Frontend calculation module ✅ done
- [x] `src/features/billing/lib/calculations.ts` — ported verbatim from `frontend_setup.md §4` (`calculateItemTotal`, `calculateInvoiceTotals`, `calculateNewPending`). This is the same module used for both the live POS display and producing the exact numbers sent in the `POST` body — no second implementation to drift out of sync.
- **Discovered while verifying (documentation-only inconsistencies, not a bug in this code — ported verbatim as planned):** `REQUIREMENTS.md`'s own example item (`net_wt_g: 7.6, rate_per_gram: 6250, making_charge: 1800, stone_charge: 500`) arithmetically totals ₹49,800 via this formula, not the ₹49,850 shown in that same example payload. Separately, `calculateInvoiceTotals()` always rounds `grandTotal` to a whole rupee (`Math.round`), while that example's `grand_total: 50830.5` is fractional. Neither breaks anything — the backend never recomputes item/invoice totals (decision 7), and the ₹1 tolerance check absorbs the rounding gap — but flagged since the spec's own illustrative numbers don't quite add up.

### Phase 7 — Frontend state ✅ done
- [x] `src/store/useBillingStore.ts` — in-memory only (not persisted to `localStorage`), holds the draft: customer fields, `items[]`, discount, GST%, initial payment input. `addItem`/`updateItem` always derive `total` via `calculations.ts` rather than trusting a passed-in value, plus a `hasTag()` check used before adding a tag-linked item (client-side duplicate-tag guard, mirroring the server-side one). Cleared on successful submit or explicit abandon (`reset()`).

### Phase 8 — Frontend hooks ✅ done
- [x] `src/features/billing/hooks/useCustomerLookup.ts` — `GET /api/customers?phone=`. A `404` (no such customer) resolves to `data: null` rather than an error state — `REQUIREMENTS.md` calls this the expected outcome for a first-time walk-in, not a failure.
- [x] `src/features/billing/hooks/useCreateInvoice.ts` — mutation, invalidates tags list + invoices list on success.
- [x] `src/features/billing/hooks/useAddPayment.ts` — mutation, invalidates that invoice's detail query + invoices list.
- [x] `src/features/dashboard/hooks/useInvoicesList.ts` (per `frontend_setup.md`'s existing plan) — list query for the ledger table.
- [x] `src/lib/api-client.ts` extended: `ApiError` now also carries an optional `codes?: string[]`, populated from the response body. Needed because `POST /api/invoices`'s `404`/`409` tag-conflict responses return exactly which tag code(s) failed (`{error, codes}`) — the generic error handler only read `error`/`fields` before, which would have silently dropped that array.

### Phase 9 — Frontend components ✅ done (and substantially hardened since, see "Round 2" below)
- [x] `src/features/billing/components/CustomerFields.tsx` — phone input, explicit-confirmation lookup (redesigned in Round 2, see §3 below), all fields stay editable.
- [x] `src/features/billing/components/ScanInput.tsx` — the "Enter Code" path (manual typing works identically to a scanner gun).
- [x] `src/features/billing/components/TagBrowseDialog.tsx` — the "Browse Tags" path (decision 11).
- [x] `src/features/billing/components/ItemTable.tsx` — editable rows from any of the three entry paths, plus "Add Item" as a modal (Round 2 §4), live mandatory-field validation, decimal-safe numeric cells (Round 2 §7), auto-recomputed Net Wt (Round 2 §8).
- [x] `src/features/billing/components/TotalsPanel.tsx` — subtotal/discount/GST/grand total, via `calculations.ts`.
- [x] `src/features/billing/components/PaymentPanel.tsx` — initial payment (optional — credit sales are valid) at creation; reused as a dialog for `useAddPayment` on the invoice detail page; "Pay Remaining"/"Pay in full" shortcut added (Round 2 §10).
- [x] `src/features/billing/components/NumberField.tsx` — not in the original plan, added in Round 2 to fix a real leading-zero display bug (§1) across every numeric field.
- [x] ~~`src/components/ui/{Table,Badge,Card}.tsx`~~ — **revised**: the existing codebase deliberately doesn't abstract these. `TagsTable.tsx`/`MetalRatesTable.tsx` write raw `<table>` markup inline per component, and a "card" is just the `panel` utility class applied directly — no `Table.tsx`/`Card.tsx` exists anywhere. Following that same convention for the ledger/item tables and status badges rather than introducing a new abstraction this codebase doesn't otherwise use.
- [x] `src/components/ui/Dialog.tsx` — the one genuine new primitive, since no modal exists anywhere in the app yet (needed by `TagBrowseDialog` and the invoice detail page's "Collect Payment" dialog). Hand-rolled (`createPortal`, Escape-to-close, click-outside-to-close), following the existing design-token system (no shadcn CLI installed, matching `Button.tsx`/`Input.tsx`'s own hand-rolled pattern).

### Phase 10 — Frontend pages ✅ built, ⚠️ not yet visually verified
- [x] `src/app/(app)/billing/page.tsx` — replaces the placeholder. Assembles `CustomerFields` + item-entry (`ScanInput`/`TagBrowseDialog`/manual) + `ItemTable` + `TotalsPanel` + `PaymentPanel` + a "Finalize Sale" action, then the post-sale confirmation state (decision 12).
- [x] `src/app/(app)/invoices/page.tsx` — ledger table (`InvoiceTable.tsx`, under `features/dashboard/components` per `frontend_setup.md`'s original grouping), View + Print actions only, **no delete button** (decision 5).
- [x] `src/app/(app)/invoices/[id]/page.tsx` — detail view + "Collect Payment" dialog (reuses `PaymentPanel` with a new `bare` prop, to avoid a panel-inside-panel double border).
- [x] `src/app/(app)/invoices/[id]/print/page.tsx` — receipt layout via `GET /api/invoices/:id/print`, `window.print()` from a `useEffect` guarded by a ref so it only fires once per load. **Deviated from `frontend_setup.md §6.2`**: that section suggested a Server Component fetching server-side, but the session token lives only in `sessionStorage` (decision #8) - a server-rendered page has no way to attach it to the request, same reason every other protected page in this app fetches client-side. Built as a Client Component instead.
- [x] `src/components/layout/Sidebar.tsx` — added an "Invoices" nav entry (was missing entirely; only "Billing" existed).
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm build` all clean, including a full production build confirming every route compiles and resolves correctly (`/billing`, `/invoices`, `/invoices/[id]`, `/invoices/[id]/print` all appear in the route manifest).
- **Not done**: a live browser walkthrough. The Chrome extension wasn't connected this session (`tabs_context_mcp` returned "Browser extension is not connected"), so none of this has been visually confirmed to render or behave correctly beyond static analysis, typecheck, and a production build. Per this project's own working rule ("if you can't test the UI, say so explicitly rather than claiming success") - **this phase is not actually done** until someone (the user, or me with the extension connected) clicks through it for real.
- **Real bug found via manual testing (user-reported) and fixed**: `useAddTagItem.ts`'s `fetchCurrentRate()` called `apiClient.get<PurityRow[]>()` and then `.find()` directly on the result, but `GET /api/purities` returns `{data: [...]}` - same envelope as every other list endpoint in this app - not a bare array. Crashed with `purities.find is not a function` the moment a tag was added via Browse Tags (or Enter Code - same code path). Fixed by unwrapping `.data`, reusing `useMetalPurities.ts`'s own `MetalPurity` type instead of a second, now-clearly-fragile local shape.
  - **A second bug found while auditing the same function, not yet hit by a user**: the fetch defaulted to active-only purities, so a tag whose purity was later archived in Settings would have silently resolved to `rate_per_gram: 0` instead of its real last-known rate - no crash, just a wrong number the cashier would have had to notice and correct by hand. Fixed by adding `includeInactive=true` to this specific internal lookup (never exposed as a user-facing dropdown, so there's no risk of this encouraging someone to pick an archived purity for a new tag).
  - Audited every other `apiClient.get<...>()` call across the billing/dashboard frontend code against its actual route response shape (`useCustomerLookup`, `useCreateInvoice`, `useAddPayment`, `useInvoicesList`, `useInvoiceDetail`, `useInvoicePrintData`, `TagBrowseDialog`'s `useTags` usage) - all already correct, this was the only mismatch.
  - Verified both fixes by replaying the exact two-request sequence `useAddTagItem` performs (`GET /api/tags/:code` then `GET /api/purities?metal=&includeInactive=true`) against real seeded data: an active-purity tag (resolved 6250 correctly) and an archived-purity tag (resolved 5900, not 0). Test data cleaned up after.
- **Real bug found via manual testing (user-reported) and fixed - validation feedback was effectively invisible.** `billing/page.tsx`'s `onError` only ever showed `error.message` ("Validation failed"), never `error.fields`; no form component had any mechanism to turn a field red at all. Fixed properly rather than patching the toast text:
  - `handleFinalize` now runs `createInvoiceSchema.safeParse(body)` **client-side**, with the exact same schema the server uses, before ever calling the mutation. This gives full-precision Zod issue paths (`["items", 2, "purity"]`, `["customer", "phone"]`) that the server's own 422 response can't provide - `validation.ts`'s `flattenError()` collapses everything to one message per top-level field, which would only ever say "items" or "customer" generically, never which row or sub-field.
  - Added `fieldErrors`/`itemErrors` to `useBillingStore` (dot-path keyed for everything outside `items[]`, item-index keyed for per-row issues), populated from the parsed issues, cleared automatically by every mutating store action (`addItem`, `updateItem`, `removeItem`, `setCustomer`, etc.) so a fixed field doesn't keep showing red indefinitely.
  - `CustomerFields`, `TotalsPanel`, and `ItemTable` read these directly from the store (all three are billing-page-only). `PaymentPanel` takes an explicit `error?` prop instead (it's reused on the invoice detail page's "Collect Payment" dialog, which has nothing to do with this validation state).
  - `ItemTable` additionally renders a red summary line under any row with an error, covering fields that have **no inline editor in the grid at all** (`purity`, `hsn_code`, `metal`, `pieces` - see below, `gross_wt_g`/`stone_wt_g` since got their own columns) - those would otherwise have no way to surface a problem to the cashier whatsoever.
  - Verified the parsing logic directly against a deliberately broken payload (empty phone, empty purity on one item, empty HSN on another, duplicate `tag_code`, overpaid): confirmed `customer.phone`/`paid_amount` landed as top-level field errors, the duplicate-tag issue landed as a whole-`items` banner, and the two per-item issues landed correctly keyed by their exact row index - nothing silently dropped.
- **Mandatory-fields hardening (user-requested) - Description/Gross Weight/Net Weight/Rate per gram made mandatory consistently across backend, add-item, and the grid; Gross/Stone Weight added as visible columns in both the grid and the print receipt.** Audited the same three fields across all three layers first, since "mandatory" turned out to mean three different things in three different places:
  - **Backend** (`invoice.schema.ts`): `gross_wt_g` and `net_wt_g` went from `.min(0, ...)` (literal `0` was a valid, passing value) to `.positive(...)` - a `0` weight is not "not entered yet," it's physically meaningless for a line actually being billed. `rate_per_gram` got the same change, closing a real gap: the earlier "Rate per gram is mandatory" fix was client-only, the backend schema itself still silently accepted `0`. `stone_wt_g` was deliberately left as `min(0)` - a plain gold band genuinely has zero stone weight, that's a valid real value, not a missing one.
  - **"Add Item Manually" form**: `canAdd` now also requires `grossWtG > 0` and `netWtG > 0` (joining the existing description/rate gates), each with the same `*` label + inline red message treatment as Rate per gram got. User explicitly declined extending this gate to `purity`/`hsn_code` - those are already correctly required server-side, left ungated client-side on purpose for now.
  - **The grid**: added **Gross Wt (g)** and **Stone Wt (g)** as new visible, editable columns (previously Gross Wt only existed at add-time and Stone Wt wasn't shown anywhere). Both wired into the existing `SCHEMA_FIELD_NAMES`/red-highlighting system from the validation-visibility fix above - no new mechanism needed, since the same client-side `safeParse` on Finalize already re-validates the whole `items[]` array including whatever was just typed into the grid.
  - **Print receipt** (`invoices/[id]/print/page.tsx`): added Gross Wt (g) and Stone Wt (g) columns, which didn't exist before (only Net Wt was shown).
  - **Not yet done**: the invoice **detail** page's item table (`invoices/[id]/page.tsx`) still shows less than print (no HSN, no gross/stone weight, no charges) - flagged to the user, answer still pending.
  - Verified the tightened schema directly: `gross_wt_g`/`net_wt_g`/`rate_per_gram` at `0` each correctly rejected with their specific message; `stone_wt_g` at `0` still correctly passes.

### Phase 11 — End-to-end verification ✅ done (Chrome extension finally connected)
- [x] Full manual walkthrough, live in the browser, logged in as the real user (session token injected directly - no real password available): customer lookup (exact-match card → "Use this customer" → autofill confirmed), Add Item modal (decimal Gross/Stone/Rate typed correctly, Net Wt auto-computed, no background dimming), Browse Tags (searched and selected a seeded test tag - this is the exact flow the `purities.find is not a function` bug broke, confirmed fixed, rate auto-filled correctly from the real purity catalog), duplicate-tag rejection via Enter Code (clean toast, no crash), editing a grid cell's Gross Wt with a decimal live (Net Wt correctly recomputed, totals recalculated correctly - verified by hand), "Pay in full" / "Finalize Sale" (invoice created successfully, confirmation screen correct), the invoices ledger (correct data, no delete button), an existing partial invoice's "Collect Payment" dialog with "Pay remaining" (payment recorded, status flipped to `paid`), and confirmed the sold tag's status update on `/tagging`. **Zero console errors across the entire walkthrough.**
- [x] Re-confirmed Tagging unaffected (`TAG-WALKTEST1` correctly showed `Sold` after the sale).
- **Real, new finding from this pass**: duplicate customer records exist in the actual database for the same person under phone numbers `7379972427` and `07379972427` (leading-zero variant) - confirms a genuine data-quality gap: the lookup only does an exact match on exactly 10 digits, so a customer whose phone was ever typed with an extra leading digit (a common habit from STD-code conventions) can never be found by a later lookup, silently creating a second profile instead. Not a crash. **Deferred — the user has explicitly said this will be fixed later**, not addressed in this pass. Candidate approaches when it's picked up: normalize phone input (strip a leading zero before lookup/storage), or treat a leading `0` specially in the match.
- **Testing limitation worth recording**: `window.print()` firing on the print/receipt pages opens a native OS-level dialog that blocks the Chrome extension's scripting entirely (confirmed twice, on both `/invoices/:id/print` and the per-payment receipt page) - this is correct, intended behavior (that's the whole point of those pages), but it meant I could confirm both pages resolve to the right URL with the right data and don't error, without being able to screenshot their actual rendered layout. Recommend a manual look at the print layout specifically.
- [x] All test data (`TAG-WALKTEST1`, the test invoice `INV-2026-0009` created during this walkthrough) deleted afterward. The one real, intentional write kept: collecting the ₹591 pending balance on the real `INV-2026-0007` - a legitimate action, not test pollution, confirmed correct (now `paymentStatus: "paid"`, `pendingAmount: 0`).
- [x] Updated `docs/PROGRESS.md` to reflect all of this.

---

## Validation checklist (everything that must be enforced, and where)

**`createInvoiceSchema` (Zod, structural):**
- `customer.name`/`customer.phone` required; `email` valid format if present; `address` optional.
- `items`: array, `min(1)` — an invoice needs at least one line.
- Per item: `description`/`hsn_code`/`metal`/`purity` required non-empty strings; `pieces` positive integer; `gross_wt_g`/`stone_wt_g`/`net_wt_g`/`rate_per_gram`/`making_charge`/`stone_charge`/`total` all `>= 0`; `tag_code` optional string.
- `discount_amount >= 0`; `gst_percent` within a sane `0–100` range; `gst_amount`/`subtotal`/`grand_total` all `>= 0`.
- `payment` object optional; if present, `amount > 0` and `mode` is one of `cash|upi|card|bank_transfer`.
- `paid_amount`/`pending_amount` `>= 0`; `payment_status` one of `unpaid|partial|paid`.

**Cross-field checks (Zod `.refine`, still structural, not business recomputation):**
- `paid_amount <= grand_total` (rule 5, "No Negative Pending Balances" — the one arithmetic relationship the spec explicitly requires the server to enforce).
- `|grand_total - (subtotal - discount_amount + gst_amount)| <= 1` (decision 6).
- No duplicate `tag_code` across `items[]` (decision 8).

**Service-layer checks (inside the transaction, can't be expressed in Zod since they need a DB read):**
- Every non-null `tag_code` must resolve to an existing tag → else `404`.
- Every resolved tag must have `status === "tagged"` → else `409`, and the error must list **every** conflicting code found, not just the first (so the cashier can remove exactly the right items and retry without a second failed round-trip).

**`POST /api/invoices/:id/payments`:**
- `amount > 0`, valid `mode`.
- Resent `paid_amount <= grandTotal` (same rule, re-enforced here even though the rest of the aggregate is trusted per decision 4).
- Invoice must exist → else `404`.

**`DELETE /api/invoices/:id`:**
- Invoice must exist → else `404`.
- Transaction ensures tag-revert and invoice-delete happen together or not at all.

**Cross-cutting, same as every other route in this app:**
- Every route calls `requireAuth()` first (🔒) — no exceptions.
- Every route handler starts with `await dbConnect()`.
- None of these route files may set `export const runtime = "edge"` — transactions require the Node.js runtime, and the default is already correct, so this is a "don't break it" check, not new work.

**Frontend:**
- `React Hook Form` + the exact same Zod schema (`zodResolver(createInvoiceSchema)`) as the backend — single source of truth, same pattern as `TagForm.tsx`, so a validation rule never has to be written twice or drift between client and server.
- `ScanInput`/`TagBrowseDialog` both surface `404`/`409` as `sonner` toasts without corrupting the in-progress draft — a bad scan/pick never wipes out items already added.
- The "Finalize Sale" submit handler must surface a `404`/`409` from the server (e.g. a tag sold by someone else in the seconds between scanning and submitting) by identifying exactly which item failed, not a generic error — the cashier needs to remove that one line and retry, not restart the whole sale.

---

## Round 2 of user-reported bugs (post-build, from real usage)

### 1. Leading-zero stuck display across every numeric field on the billing page
**Real bug, screenshot-confirmed**: typing into a weight/rate/charge field could leave a literal `"011"` stuck on screen. Root cause: `<input type="number">` has a known React controlled-input quirk — React tracks the last *parsed* value it rendered, and can skip writing to the DOM when a new keystroke's parsed value matches that (`Number("011") === 11`, which is what React already believed it had rendered), leaving the literal text stuck even though the underlying state was correct.

**Fix**: every numeric field across the billing page switched from `type="number"` to `type="text"` + `inputMode="decimal"`, with manual sanitization (reject non-digit/non-decimal-point characters; strip a leading zero the instant a further digit follows it, e.g. `"011"` → `"11"`; refill `"0"` on blur if left empty) - no plain-text input has this DOM-skip quirk, since React always syncs a text input's value on every render.
- `src/features/billing/lib/numericInput.ts` — the shared, pure sanitize function (`sanitizeNumericInput`, `isValidNumericInput`), unit-verified against a battery of cases (`"01"→"1"`, `"0.50"` untouched, `"1.2.3"`/`"abc"` rejected, etc.).
- `src/features/billing/components/NumberField.tsx` — composes the **existing** `Input` primitive (doesn't modify it) with this sanitize + blur-refill behavior. Input.tsx itself is untouched, so Settings/Tagging/Auth forms (which drive their own number inputs through react-hook-form's different value-handling) carry zero risk from this change.
- Applied to: `ManualAddForm`'s 7 numeric fields, the grid's `ItemCellInput` (6 numeric fields, sanitized inline rather than via `NumberField` since the grid's cells are borderless and don't use the bordered `Input` styling), `TotalsPanel`'s discount/GST, `PaymentPanel`'s amount.
- `src/features/billing/lib/useNumericStoreField.ts` — a second piece needed specifically for fields whose canonical value lives in the Zustand store as a number (discount, GST%, payment amount), not local component state like `ManualAddForm`'s fields: naively doing `value={String(storeValue)}` / `onChange={(v) => setStoreValue(Number(v) || 0)}` breaks decimal entry, because typing "0" then "." round-trips through `Number("0.") === 0` on every keystroke, wiping the "." before the next digit can be typed. The hook keeps a local display buffer (so `"0."` can exist mid-typing) while still pushing a parsed number into the store live, and resyncs the buffer if the store changes from somewhere else entirely (e.g. `reset()` after a sale) by comparing against the number it last pushed itself - same "derive during render" pattern used elsewhere in this app for external-state sync.

### 2. Rate per gram = 0 didn't show red, and "Finalize Sale" stayed clickable
**Real bug, screenshot-confirmed**: a grid row with `rate_per_gram: 0` showed no red highlighting at all, and the Finalize Sale button wasn't disabled. Root cause: the red-highlighting/row-banner system built in the previous round only populates `itemErrors` **after** an explicit submit attempt runs the full `createInvoiceSchema.safeParse()` - a row that was never submitted had no errors computed for it yet, so nothing could show red, and `canFinalize` never checked per-item validity at all (only customer name/phone + `items.length > 0`).

**Fix**: `src/features/billing/lib/itemValidity.ts` — `isItemValid()`, a cheap synchronous mirror of the schema's description/gross-weight/net-weight/rate-per-gram mandatory checks (purity/hsn_code deliberately excluded, per the earlier product decision). Used in two places:
- `ItemTable.tsx`: each row now merges `getLiveItemErrors(item)` (computed straight from the item, no submit needed) with any `itemErrors[index]` from a prior submit attempt - whichever source flags a problem is enough to turn the row red immediately, as it's typed.
- `billing/page.tsx`: `canFinalize` now also requires `items.every(isItemValid)` - the button is proactively disabled while any item has a 0/empty mandatory field, not just reactively after a failed click.
- Added `*` to every mandatory column header in the grid (`Description *`, `Gross Wt (g) *`, `Net Wt (g) *`, `Rate/g *`), matching the asterisks already on the add-item form's labels.

### 3. Customer lookup redesigned (not actually broken - a UX gap, clarified with the user first)
User initially reported "no customer lookup functionality available." Code review found the underlying logic (debounced `GET /api/customers?phone=`, confirmed working via extensive curl testing) was likely sound, but there was **zero visible feedback** - no loading state, no found/not-found indicator, nothing confirming a lookup ever happened, and it silently auto-applied without the cashier choosing to. Asked the user directly what they actually wanted rather than guessing; the answer was a real redesign, not a bug fix: an explicit confirmation step instead of silent auto-apply, and (on a follow-up message) the lookup should only fire once a complete 10-digit number is entered, not on every partial keystroke.
- `src/features/billing/hooks/useCustomerLookup.ts` — `enabled` tightened from `phone.trim().length > 0` to `/^\d{10}$/.test(phone.trim())`. Confirmed this hook has exactly one caller (`CustomerFields.tsx`), so tightening it here is safe.
- `src/features/billing/components/CustomerFields.tsx` — rewritten:
  - Debounce only starts once the phone is a complete 10 digits (resets to disabled, via the render-time-derive pattern, the instant it becomes incomplete again - not a synchronous `setState` in a `useEffect` body, which the lint rule from the previous round's fix already catches).
  - While incomplete: hint text, "Enter the full 10-digit number for an exact match."
  - While the (now-enabled) query is in flight: "Looking up…"
  - On a match: a confirmation card (name/email/address + an explicit **"Use this customer"** button) - nothing is applied until clicked. A `appliedPhone` flag suppresses re-showing the same card once used.
  - On no match: "No customer found with this number. Enter details manually below." (neutral styling, not red - a new walk-in is the expected common case, not an error, consistent with how `useCustomerLookup` already treats a 404).
  - Scope confirmed with the user before building: **exact match only**, no backend changes - `GET /api/customers?phone=` is reused exactly as it already is. A true partial/prefix-search typeahead was explicitly declined as out of scope for now.

All three verified via `pnpm typecheck` / `pnpm lint` / `pnpm build` after each change. Not yet verified in an actual browser - the Chrome extension remains unavailable this session (checked again before this round, still "Browser extension is not connected").

### 4. "Add Item" converted to a modal, repositioned before "Browse Tags" (user-requested UX change, not a bug)
`ManualAddForm` moved from an inline expand-in-place panel (toggled by a ghost button below the table) into the existing `Dialog` primitive - same component already used for `TagBrowseDialog`, so no new UI primitive needed. Given `className="max-w-2xl"` (wider than `Dialog`'s default `max-w-lg`, via `cn()`/`tailwind-merge` correctly overriding it) since the form's 4-column grid of labeled fields needs more room than a typical modal.

The trigger button moved from a ghost button below the table into the header row, positioned **before** "Browse Tags" (`Items  [+ Add Item]  [Browse Tags]`), same `variant="outline"` styling as Browse Tags so the two read as a matched pair of ways to add a line. Header row given the same responsive wrap pattern already used in `TagsTable.tsx`/`InvoiceTable.tsx` (`flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`).

Scope was entirely contained to `ItemTable.tsx` as predicted in the plan - the toggle state and `ManualAddForm` were already local to that file, so no other component, hook, or page needed changes. All of the form's own logic (validation, live mandatory-field checks, net-weight auto-calc, numeric-input sanitization) is untouched, only its container changed.

### 5. Add Item dialog's background dimming removed (user-requested)
`Dialog.tsx` gained an optional `dimBackground` prop (default `true`, unchanged for every existing usage) - `false` drops the `bg-background/80` overlay class entirely while keeping the same click-outside-to-close behavior. Set `dimBackground={false}` only on the Add Item dialog in `ItemTable.tsx`; `TagBrowseDialog`'s overlay is untouched since that wasn't part of the request.

### 6. Net weight auto-calc rounded to the wrong precision (user-reported, screenshot-confirmed)
`ManualAddForm`'s net-weight auto-calc (`gross - stone`) rounded to 2 decimal places, but gross/stone weights are routinely entered to 3 (milligram precision) - e.g. `22.972 - 2.067 = 20.905` was rounding to `20.91`, both losing a real digit and rounding the wrong way. Fixed by rounding to 3dp instead of 2 in `src/features/billing/components/ItemTable.tsx`. The identical formula, copied from there originally, also existed in `src/features/tagging/components/TagForm.tsx` (the Tagging module's create-tag form) with the same bug - fixed there too, confirmed with the user before touching a file outside the billing module. Verified directly: `22.972 - 2.067` now correctly produces `20.905`.

### 7. Couldn't type a decimal directly into the grid's numeric cells (user-reported, investigated via plan mode)
Real bug, root-caused precisely: `ItemCellInput`'s numeric cells (Gross/Stone/Net Wt, Rate/g, Making, Stone Charge) rendered `value={value}` straight from `BillingItem[field]` (a plain `number`), while the parent's `handleFieldChange` converted every keystroke to `Number(raw) || 0` immediately, with no local string buffer in between - typing `.` after `15` produced raw `"15."`, `Number("15.")` collapsed it to `15`, and the next render showed `"15"`, silently dropping the `.` before the next digit could be typed. The Add Item modal never had this problem because its fields are local string state, only converted to a number once at submit - not on every keystroke.

Fixed by reusing `useNumericStoreField` (already built this session for `TotalsPanel`/`PaymentPanel`'s identical problem) **inside** `ItemCellInput` itself - confirmed via a dedicated codebase search that this grid was the only remaining place with this bug pattern (everywhere else is read-only, text/select fields, or `TagForm.tsx`'s uncontrolled `register(..., {valueAsNumber: true})`, which doesn't have this issue). Only `ItemCellInput`'s body changed; `handleFieldChange`, the store, and the schema are untouched - the hook's number output is bridged back to the parent's existing string `onChange` contract via `onChange(String(n))`, which round-trips exactly. Text cells (`description`) are unaffected - the hook is still called (Rules of Hooks requires unconditional calls) but fed a constant `0` and its output ignored. Added an `onBlur` canonicalization (`"15."` → `"15"`, `"15.50"` → `"15.5"`) that also closes a narrow edge case around row removal (rows are keyed by array index, same as the rest of the app - blur fires before a remove-button click, so no non-canonical buffer text can survive into a reused slot).

Verified via a full keystroke-by-keystroke paper trace typing `15.5` (confirmed the `.` is preserved at each step, unlike the old code), plus clear-then-blur (`→"0"`) and `"15."`-then-blur (`→"15"`) traces. This was planned via Plan Mode first (Explore + Plan subagents used to confirm the diagnosis and design against the real code before writing any code) - plan saved at the time to `~/.claude/plans/after-adding-the-item-spicy-babbage.md`.

### 8. Editing Gross/Stone Wt in the grid never recomputed Net Wt - a pre-existing gap, not a regression from #7 (user-reported, initially suspected as a regression - checked and corrected)
User reported this as something broken by the decimal-input fix above. Checked precisely before fixing: `handleFieldChange` in the grid has **never** recomputed Net Wt from Gross/Stone - that auto-calc logic only ever existed in `ManualAddForm` (the Add Item modal). Confirmed via `git log`/`git status` that this entire file has no prior committed version (written untracked this session), so there was no earlier "working" version of this cross-field logic to regress from - it's a feature gap in the grid that was never built, not something fix #7 broke. Said so plainly rather than silently fixing it without correcting the misattribution.

Fixed by extending `handleFieldChange`: when the edited `field` is `grossWtG` or `stoneWtG`, it now also computes `netWtG = Math.max(0, gross - stone)` (rounded to 3dp, same formula and precision as `ManualAddForm` and the Tagging module's `TagForm.tsx`) using the item's current other weight field, and bundles both the edited field and the recomputed `netWtG` into one `updateItem` call. Editing Net Wt directly still works and isn't immediately overwritten - only touching gross or stone re-triggers the recompute, matching the modal's exact established philosophy ("auto-computed, still fully editable, recalculated again any time gross/stone change").

Traced end-to-end through the decimal-buffer system from fix #7 to confirm the two fixes compose correctly: editing Gross Wt pushes `{grossWtG, netWtG}` in one combined store update - the Gross cell's own `useNumericStoreField` buffer isn't disturbed (its own `lastPushed` already matches, so it keeps showing exactly what was typed), while the Net Wt cell's buffer detects its stored value changed from something other than its own last push and correctly resyncs its display to the new computed value.

### 9. Per-payment receipts (user-requested feature, design previewed via Artifact before building)
User wanted a way to give a customer a receipt for one specific partial payment on an invoice with multiple payments - "this amount is paid, this is still pending, here's the invoice to follow up on." Two design questions resolved before building: (1) payment-only slip vs. one that also lists the purchased items - previewed both as an Artifact mockup side by side, user picked payment-only; (2) entry point - invoice detail page's payment history only, not also offered from the post-sale Billing page screen.

**No new backend endpoint** - `GET /api/invoices/:id/print` already returns the full `payments[]` array; the new page just picks out one payment by its position in that array (payments have no stable id of their own, and are append-only with no edit/delete-payment feature, so the array index is a reasonably stable address for now) and derives the slip's numbers from it.

- `src/app/(app)/invoices/[id]/payments/[index]/receipt/page.tsx` - new route, Client Component (same reasoning as the main print page - session token lives only in `sessionStorage`), reuses `useInvoicePrintData`. Validates the index is an integer within `payments.length`, else shows "No payment found at this position."
- **"Paid to date" is a snapshot as of that specific payment**, not the invoice's current `paid_amount` - computed as `payments.slice(0, index + 1).reduce((sum, p) => sum + p.amount, 0)`, so a receipt reprinted later keeps showing what was true at the moment that payment was made, not silently picking up payments collected afterward. Verified directly against a two-payment example (₹10,000 then ₹15,000 against a ₹50,830.50 invoice): payment 0's receipt correctly shows paid-to-date ₹10,000/pending ₹40,830.50; payment 1's receipt shows ₹25,000/₹25,830.50 - each a true historical snapshot.
- `src/app/(app)/invoices/[id]/page.tsx` - added a small `Receipt` icon button next to each row in the Payments list, opening the new route in a new tab (same pattern as the main invoice's Print button).
- Visual design matches the existing print page's conventions exactly (shop header, `gold-rule`, `font-display`) rather than the Artifact mockup's bespoke CSS - the mockup was only ever for picking a layout, not something to ship as-is.
- **Follow-up (user feedback): the "Paid to date" line was removed from the slip as unnecessary noise.** The calculation is kept (`paidToDate` is still what `pendingAtThatPoint`/"Balance pending" is derived from internally), only the standalone displayed row was dropped - the slip now shows Received today / Invoice total / Balance pending.

### 10. "Pay Remaining"/"Pay in full" one-click button (user-requested)
Added a small text-button in `PaymentPanel.tsx` that fills the amount field with `grandTotal` in one click - labeled "Pay remaining" on the invoice detail page's Collect Payment dialog (`bare=true`, `grandTotal={invoice.pending_amount}`) and "Pay in full" on the billing page's initial-sale panel (`bare=false`, `grandTotal={totals.grandTotal}`), since the same prop already means different things in each context and the component didn't need any new prop to support this. Routes through `amountField.onValueChange(String(grandTotal))` - the exact same path manual typing already uses - rather than a second, parallel way of setting the payment, so the display buffer/`lastPushed`/store update all stay in sync through one mechanism. Verified the resulting `{amount, mode}` object directly with a small script mirroring the hook's logic.

Repositioned per follow-up feedback: moved from next to the "Amount Paid Now" label down to sit beside the "Up to ₹X" hint below the input, in the same row. Along the way, fixed a mistake from the first placement - the button had been put inside the `error ? ... : ...` branch that only renders when there's no validation error, which would have hidden it exactly when it's most useful (the button sets a known-valid amount, so it doubles as the fix for "you typed too much"). Now both the hint/error text and the button live in the same always-rendered row, swapping only which text shows on the left.
