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

### Phase 2 — Backend validation schema
- [ ] `src/schemas/invoice.schema.ts`:
  - `createInvoiceSchema` — full `POST /api/invoices` body (see Validation checklist below for every rule it must encode).
  - A schema (or reused `invoicePaymentInputSchema`) for `POST /api/invoices/:id/payments`'s body.
- [ ] Reuse `src/schemas/customer.schema.ts` where the embedded `customer` object overlaps, if it doesn't force an awkward shape — otherwise a dedicated inline object is fine, same as `DATABASE_DESIGN.md`'s own embedded customer shape.

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

### Phase 6 — Frontend calculation module
- [ ] `src/features/billing/lib/calculations.ts` — ported verbatim from `frontend_setup.md §4` (`calculateItemTotal`, `calculateInvoiceTotals`, `calculateNewPending`). This is the same module used for both the live POS display and producing the exact numbers sent in the `POST` body — no second implementation to drift out of sync.

### Phase 7 — Frontend state
- [ ] `src/store/useBillingStore.ts` — in-memory only (not persisted to `localStorage`), holds the draft: customer fields, `items[]`, discount, GST%, initial payment input. Cleared on successful submit or explicit abandon.

### Phase 8 — Frontend hooks
- [ ] `src/features/billing/hooks/useCustomerLookup.ts` — `GET /api/customers?phone=`.
- [ ] `src/features/billing/hooks/useCreateInvoice.ts` — mutation, invalidates tags list + invoices list on success.
- [ ] `src/features/billing/hooks/useAddPayment.ts` — mutation, invalidates that invoice's detail query.
- [ ] `src/features/dashboard/hooks/useInvoicesList.ts` (per `frontend_setup.md`'s existing plan) — list query for the ledger table.

### Phase 9 — Frontend components
- [ ] `src/features/billing/components/CustomerFields.tsx` — phone input, autofill-on-lookup, all fields stay editable.
- [ ] `src/features/billing/components/ScanInput.tsx` — the "Enter Code" path (manual typing works identically to a scanner gun).
- [ ] `src/features/billing/components/TagBrowseDialog.tsx` — new, the "Browse Tags" path (decision 11).
- [ ] `src/features/billing/components/ItemTable.tsx` — editable rows from any of the three entry paths, plus the "Add Manually" inline form.
- [ ] `src/features/billing/components/TotalsPanel.tsx` — subtotal/discount/GST/grand total, via `calculations.ts`.
- [ ] `src/features/billing/components/PaymentPanel.tsx` — initial payment (optional — credit sales are valid) at creation; reused as a dialog for `useAddPayment` on the invoice detail page.
- [ ] `src/components/ui/{Table,Dialog,Badge,Card}.tsx` — not yet built (only `Button`/`Input`/`Label`/`Select` exist); needed by the ledger table, browse dialog, and status badges. Hand-rolled Tailwind, following the existing design-token system (no shadcn CLI installed).

### Phase 10 — Frontend pages
- [ ] `src/app/(app)/billing/page.tsx` — replaces the current placeholder. Assembles `CustomerFields` + item-entry (`ScanInput`/`TagBrowseDialog`/manual) + `ItemTable` + `TotalsPanel` + `PaymentPanel` + a "Finalize Sale" action, then the post-sale confirmation state (decision 12).
- [ ] `src/app/(app)/invoices/page.tsx` — ledger table (`GET /api/invoices`), View + Print actions only, **no delete button** (decision 5).
- [ ] `src/app/(app)/invoices/[id]/page.tsx` — detail view + "Collect Payment" action.
- [ ] `src/app/(app)/invoices/[id]/print/page.tsx` — receipt layout via `GET /api/invoices/:id/print`, `print:hidden` on `Sidebar`/`Header` (same trick already proven for tag labels), `window.print()` from a small client component after mount.

### Phase 11 — End-to-end verification
- [ ] Full manual walkthrough in the browser: look up an existing customer, edit their email, finalize a sale with one scanned tag + one manually-added item + a partial payment, confirm the tag count on `/tagging` drops, confirm the customer's record reflects the edit, print the receipt, collect the remaining payment from the detail page, confirm the ledger row updates to `paid`.
- [ ] Re-confirm none of this broke the already-shipped Tagging or Settings modules (shared `Tag`/`MetalPurity` collections).
- [ ] Update `docs/PROGRESS.md` — move this module from "not built" to "What's built," following the same level of detail as the Tagging/Metal-Rates/Customers entries already there.

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
