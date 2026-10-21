# Customers Module (List + Detail) — Implementation Plan

> **Status: built and verified, both backend and frontend** (see `docs/PROGRESS.md`). New feature, not part of the original `REQUIREMENTS.md` spec (which only ever specified the phone-lookup endpoint for POS autofill) — same situation as the tags list, metal rates, and dashboard additions. This doc captures the design, same role as `docs/dashboard-plan.md`/`docs/billing-plan.md`/`docs/metal-rates-plan.md` played for their modules.

## Why

The sidebar has had "Customers" sitting in the disabled "Coming soon" list since the project started (`Sidebar.tsx`'s `comingSoon` array). The project owner wants it activated: a searchable customer list, and clicking a customer shows their invoice history.

## Feasibility (why this is straightforward)

- `Customer.model.ts` already has every field needed (`name`, `phone`, `email`, `address`, timestamps) — no model changes.
- `Invoice.customerId` already references `Customer` (`DATABASE_DESIGN.md §2.5`) — the link between a customer and "their invoices" already exists in the data; nothing new to wire up there.
- List + search + pagination + a detail view is an already-established shape in this codebase: `TagsTable`/`useTags` (search + pagination), `invoicesService.listInvoices` (filtered list), `PurityList`/`MetalRatesTable` (list + detail-ish edit flow). This plan follows the same pattern, not a new one.
- The one real wrinkle: `GET /api/customers?phone=` already exists and is **load-bearing** — it's `REQUIREMENTS.md` endpoint #11, used by Billing's customer-autofill-by-phone flow. This plan adds list-mode to the same route rather than touching that contract (see Decision 1).

## Decisions

1. **`GET /api/customers` becomes dual-mode on the same path, branching on whether `?phone=` is present** — not a new route, not a breaking change to the existing one. `?phone=<value>` → the existing exact-match lookup (404 if unknown, used by Billing's autofill, response shape unchanged). No `phone` param → list mode (`?page=&limit=&q=`, same `{data, total, page}` envelope every other list endpoint already uses). Rationale: Billing's integration against this endpoint already works and is tested; a second route (`/api/customers/list`) would just be a worse version of the same idea with an extra URL to remember.
2. **Search matches `name` or `phone`** (regex, same escape-user-input-before-building-a-RegExp pattern as `tagsService.listTags()`) — not `email`. Simplest useful default; add email search later if it turns out to matter.
3. **List rows carry no aggregate stats** (no per-row invoice count/total spent) — keeps the list query a plain paginated `find()`, no join/aggregation cost that scales with page size. **The detail page does show stats** (`invoice_count`, `total_purchased`, `pending_amount`) via one small aggregate scoped to a single `customerId` — cheap (one customer, not a list), and genuinely useful in a CRM detail view. Asymmetric on purpose: cheap where it's shown for one record, skipped where it would multiply per row.
4. **`GET /api/invoices` gains an optional `?customerId=` filter**, not a separate `/api/customers/:id/invoices` endpoint — reuses the already-built, already-paginated invoice ledger query (and, on the frontend, the already-built `InvoiceTable` component) instead of duplicating it. Validated the same lenient way the existing `?date=` param already is on that route (regex/format check inline, silently ignored if malformed — that route doesn't use Zod for its GET query params at all, so this doesn't introduce a new validation style for just one param).
5. **No create/edit customer UI in this pass.** Customer records are still only created/updated via invoice creation (`POST /api/invoices`'s upsert-by-phone, per `bckend_setup.md §6` and the still-open question in `PROGRESS.md` decision #9 about exactly how that upsert should behave on an edited autofill). This plan is read + navigate only; editing a customer record directly is a separate, not-yet-requested feature.
6. **`findCustomerByPhone()`/`serializeCustomer()` (existing, used by Billing) are left untouched.** New serializers (`serializeCustomerListItem()`, `serializeCustomerDetail()`) are added instead of changing the existing one's shape — Billing's autofill contract (no `phone` field in the response, since the caller already has it) stays exactly as `REQUIREMENTS.md` specifies it.

## New endpoints

### 1. `GET /api/customers` (list mode — no `phone` param)

**Query params:** `page` (default 1), `limit` (default 20, capped 100 — same defaulting as `GET /api/invoices`/`GET /api/tags`), `q` (optional, matches name or phone)

**Request:**
```
GET /api/customers?page=1&limit=20&q=priya
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "data": [
    {
      "id": "...",
      "name": "Priya Mehta",
      "phone": "9812345678",
      "email": "priya@example.com",
      "address": "12 MG Road, Pune",
      "created_at": "2026-09-13T11:42:00Z"
    }
  ],
  "total": 1,
  "page": 1
}
```

**Phone-lookup mode (unchanged, existing behavior):** `GET /api/customers?phone=9812345678` → `200 {id, name, email, address}` or `404`. Still documented in `REQUIREMENTS.md` endpoint #11; not modified by this plan.

**Errors:** `401`

---

### 2. `GET /api/customers/:id`

**Request:**
```
GET /api/customers/671f2a9b1c4d5e6f7a8b9c0d
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "id": "671f2a9b1c4d5e6f7a8b9c0d",
  "name": "Priya Mehta",
  "phone": "9812345678",
  "email": "priya@example.com",
  "address": "12 MG Road, Pune",
  "created_at": "2026-09-13T11:42:00Z",
  "stats": {
    "invoice_count": 4,
    "total_purchased": 212400,
    "pending_amount": 1300
  }
}
```
- `total_purchased` = `sum(grandTotal)` across all of this customer's invoices.
- `pending_amount` = `sum(pendingAmount)` across this customer's invoices where `paymentStatus != 'paid'` — same definition as the dashboard's global `pending_amount`, just scoped to one customer.

**Errors:** `401`, `404` (unknown id or malformed ObjectId — same `Types.ObjectId.isValid()` guard `findInvoiceById()` already uses, so a typo'd URL 404s cleanly instead of 500ing on a Mongoose `CastError`)

---

### 3. `GET /api/invoices?customerId=` (extends the existing route)

**New query param:** `customerId` (optional, combinable with the existing `page`/`limit`/`date`) — adds `{ customerId }` to the existing `listInvoices()` filter when present and a valid ObjectId; silently ignored otherwise (same leniency as the existing `date` param on this route).

**Request:**
```
GET /api/invoices?customerId=671f2a9b1c4d5e6f7a8b9c0d&page=1&limit=20
Authorization: Bearer <token>
```

**Response:** unchanged shape (`{data, total, page}`), just filtered.

## Backend implementation

- `src/server/services/customersService.ts`:
  - `listCustomers({ page, limit, q })` — same shape as `tagsService.listTags()`: builds a `$or: [{name: regex}, {phone: regex}]` filter when `q` is present (regex-escaped), `.find().sort({createdAt: -1}).skip().limit()` + `.countDocuments()` in parallel.
  - `findCustomerById(id)` — `Types.ObjectId.isValid()` guard, then `findById`.
  - `getCustomerStats(customerId)` — one `Invoice.aggregate()`: `$match: {customerId}`, `$group` summing `grandTotal` (→ `total_purchased`), counting (→ `invoice_count`), and summing `pendingAmount` where `paymentStatus != 'paid'` (→ `pending_amount`, via a `$cond` inside the `$sum` or a second small aggregate — whichever reads cleaner at implementation time).
  - `serializeCustomerListItem(customer)` — `{id, name, phone, email, address, created_at}`.
  - `serializeCustomerDetail(customer, stats)` — same plus `stats`.
  - Existing `findCustomerByPhone()`/`serializeCustomer()` — **unchanged**.
- `src/app/api/customers/route.ts` — `GET` branches: `searchParams.get("phone")` present → existing logic (verbatim, untouched); absent → parse `page`/`limit`/`q` the same way `GET /api/tags`/`GET /api/invoices` already do (manual parsing with defaults, no Zod — matches those two routes' existing convention for list query params), call `listCustomers()`, map with `serializeCustomerListItem`.
- `src/app/api/customers/[id]/route.ts` (new) — `GET`, 🔒: `findCustomerById()` → `404` if missing, else `Promise.all([customer, getCustomerStats(id)])` → `serializeCustomerDetail()`.
- `src/server/services/invoicesService.ts` — `ListInvoicesParams` gains optional `customerId?: string`; `listInvoices()` adds it to the filter (`Types.ObjectId.isValid()` guard, same silently-ignore-if-malformed treatment as `date`).
- `src/app/api/invoices/route.ts` — reads `searchParams.get("customerId")`, passes through if present (no new validation layer, matches the existing `date` handling style already in this file).

No model changes. No changes to `findCustomerByPhone`/`serializeCustomer`/Billing's integration against them.

## Frontend

- `src/features/customers/hooks/useCustomers.ts` — `useQuery(["customers", params], ...)` against `/customers?page=&limit=&q=`, same shape as `useTags.ts`.
- `src/features/customers/hooks/useCustomer.ts` — `useQuery(["customer", id], ...)` against `/customers/:id`.
- `src/features/dashboard/hooks/useInvoicesList.ts` — gains an optional `customerId` param, added to its `URLSearchParams` when present (small, backward-compatible change — every existing caller keeps working unchanged).
- `src/features/customers/components/CustomersTable.tsx` — modeled directly on `TagsTable.tsx`: debounced search input (name/phone), paginated table (name, phone, email, "member since" date), **no status filter** (nothing to filter by). Each row is clickable — wrapped in a `Link` to `/customers/[id]` (same `Eye`-icon-as-affordance pattern `InvoiceTable.tsx` already uses, or the whole row — decide during build based on what feels right next to the existing tables).
- `src/features/dashboard/components/InvoiceTable.tsx` — gains an optional `customerId` prop, passed straight through to `useInvoicesList()`. When set, also accepts an optional `title` prop (default `"Invoices"`) so the customer detail page can omit/relabel the heading instead of showing a redundant second "Invoices" title under the customer's own name. Everything else about the component (its own independent date filter, pagination, status badges) stays as-is and still works per-customer.
- `src/app/(app)/customers/page.tsx` (new) — renders `CustomersTable`.
- `src/app/(app)/customers/[id]/page.tsx` (new) — a header panel (name, phone, email, address, "member since", the 3 stats tiles from the detail endpoint — small `panel` cards, same visual language as the dashboard's KPI tiles) followed by `<InvoiceTable customerId={id} title="Purchase History" />`. `404` state (unknown/bad id) renders a simple "Customer not found" message rather than crashing.
- `src/components/layout/Sidebar.tsx` — moves the `Customers` entry from `comingSoon` to `modules`, `href: "/customers"`, matching exactly how `Settings` made the same move in `docs/metal-rates-plan.md`.

## Not building in this pass

- Create/edit customer UI (decision 5) — still invoice-upsert-only.
- Email in search (decision 2) — name/phone only for now.
- Per-row stats on the list view (decision 3) — detail-page-only, for cost reasons.
- Deleting or merging duplicate customer records — the known phone-format duplication bug (`PROGRESS.md`, deferred) is a separate, already-tracked issue; this plan doesn't attempt to surface or fix it, just display customers as they exist in the collection today.

## Verification plan (once built)

1. `pnpm typecheck` / `pnpm lint` / `pnpm build` clean.
2. API via curl + a short-lived signed JWT, against real customer/invoice data:
   - `GET /api/customers` (no `phone`) → list mode, paginated, `q=` filters by partial name and partial phone.
   - `GET /api/customers?phone=<exact>` → confirm **unchanged** behavior (still 404/200 exactly as before) — this is the regression check that matters most, since Billing depends on it.
   - `GET /api/customers/:id` → 200 with correct `stats`; a known customer's `total_purchased`/`invoice_count` cross-checked by hand against their actual invoices; `pending_amount` matches the sum of their non-paid invoices' `pendingAmount`.
   - `GET /api/customers/<bad-object-id>` and `GET /api/customers/<well-formed-but-nonexistent-id>` → both `404`, neither `500`s.
   - `GET /api/invoices?customerId=<id>` → only that customer's invoices come back; combined with `?date=` still works (both filters apply together); a malformed `customerId` is silently ignored (falls back to the unfiltered list), not a `500`.
3. Manual browser walkthrough: search the customer list by partial name and by partial phone; click through to a detail page and confirm the stats and purchase history match what's in the ledger for that customer; confirm Billing's phone-autofill still works unchanged; confirm the sidebar's `Customers` entry is live and highights correctly on `/customers` and `/customers/[id]`.

## Open question for the project owner

None blocking — this plan can be built as-is. The one thing worth a quick confirmation before or during build: whether the **row-click affordance** on `CustomersTable` should be the whole row (bigger click target, matches a "browse" feel) or an explicit icon/button (matches `InvoiceTable`'s existing `Eye` icon convention) — a small UI call, not a design decision, can be made and adjusted easily either way.
