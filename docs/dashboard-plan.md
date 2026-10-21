# Dashboard Module — Implementation Plan

> **Status: both halves built and verified (see `docs/PROGRESS.md`).** This doc covers both — the two API routes and the dashboard page's UI. Same role as `docs/metal-rates-plan.md`/`docs/billing-plan.md` played for their modules.

## Why

`REQUIREMENTS.md §4.2` originally spec'd `GET /api/dashboard/summary?date=YYYY-MM-DD` (single day + vs-yesterday). Discussion with the project owner added a **date-range filter** (Today / Yesterday / Last 7 Days / Last 30 Days / This Month / Custom) driving the whole dashboard, which a single `?date=` can't express. This plan supersedes that part of the original spec: `summary` becomes range-based, comparing against the immediately preceding period of equal length instead of a hardcoded "yesterday."

## Decisions

1. **`summary` takes `from`/`to`, not `date`.** Generalizes "vs previous day" into "vs previous period" (previous period = the same number of days immediately before `from`). `sales-trend` already took `from`/`to` in the original spec — no change needed there.
2. **Two KPIs are global snapshots, not range-scoped:** `pending_amount` (total outstanding across all unpaid/partial invoices, regardless of when they were created) and `stock_on_hand` (tags currently `status: 'tagged'`). They ride inside the `summary` response for a single network call, but the frontend should present them as "as of now" rather than implying they obey the selected date range.
3. **Day boundaries are UTC**, `T00:00:00.000Z`–`T23:59:59.999Z`, matching the existing `date` filter convention in `invoicesService.ts`'s `listInvoices()`.
4. **`vs_previous_period` percentages are `null` (not `Infinity`) when the previous period's value was 0** — can't compute a meaningful percentage change from zero; frontend renders that as "—" or "new" rather than a bogus number.
5. **Max range capped at 365 days** on both endpoints — guards against an accidental all-time aggregation; 422 if exceeded.
6. **No new API for the metal-rate carousel.** `GET /api/purities` (already built) already returns `{metal, purity, rate_per_gram, active, updated_at}` for every priced purity — the carousel is a pure frontend consumer of the existing `useMetalPurities()` hook. A rate-history/trend-arrow feature would need a new collection and is explicitly **not** part of this plan (see "Not building yet").
7. **Payment-mode split and metal-wise sales split (donut chart candidates) are deferred**, not part of this plan's two endpoints — see "Not building yet." Nothing in the frontend design discussion committed to them yet.
8. **One page-level date-range state, shared by the KPI row and the chart.** A single `DateRangeFilter` drives both `useDashboardSummary()` and `useSalesTrend()` — not two independent filters. Lives as plain `useState` in `(app)/dashboard/page.tsx`, not a Zustand store: nothing else in the app needs this value, and Zustand here is reserved for state that must survive across components/pages (the billing draft) per the existing convention — a dashboard filter reset on navigation away is fine and arguably expected.
9. **No persistence of the selected range across reloads.** Defaults to **Last 7 Days** on mount every time. Simplest option; revisit only if the user actually asks for it to be remembered.
10. **The existing `InvoiceTable` ledger keeps its own independent single-date filter**, unrelated to the new range filter. It already calls `GET /api/invoices?date=` (single day, paginated management view) — unifying it with the new range filter would mean changing that endpoint's contract too, which is out of scope here. The two filters sit in different, clearly-separated parts of the page.
11. **Pending Amount and Stock on Hand render as a visually distinct "as of now" group**, separate from the range-scoped KPI tiles — per decision #2, they ignore the selected range entirely, and the UI needs to not imply otherwise (no "vs previous period" badge on these two, no date-range label touching them).
12. **`src/lib/formatters.ts` (planned in `frontend_setup.md`, never built) gets built now** — a shared `formatInr()`/`formatWeight()` instead of each new dashboard component hand-rolling its own (the existing `InvoiceTable.tsx` already has its own local `formatInr()`; new dashboard components should use the shared one, `InvoiceTable.tsx` itself is left untouched to avoid unrelated churn).

## New endpoints

Both 🔒 (`requireAuth()`), both under `src/app/api/dashboard/`, following the established `requireAuth()` → validate → `dbConnect()` → service → `Response.json()` pattern (see `src/app/api/invoices/route.ts` for the reference shape).

---

### 1. `GET /api/dashboard/summary`

**Query params:** `from=YYYY-MM-DD` (required), `to=YYYY-MM-DD` (required, inclusive, `to >= from`, range `<= 365` days)

**Validation (`src/schemas/dashboard.schema.ts` → `dashboardRangeQuerySchema`):**
- Both params required, must match `/^\d{4}-\d{2}-\d{2}$/`
- `to` must be `>= from`
- `(to - from)` in days must be `<= 365`
- Any failure → `422` via the existing `validationErrorResponse()` helper

**Request:**
```
GET /api/dashboard/summary?from=2026-10-14&to=2026-10-21
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "from": "2026-10-14",
  "to": "2026-10-21",
  "total_sales": 184500,
  "invoice_count": 7,
  "items_sold": 11,
  "net_weight_sold_g": 42.3,
  "avg_invoice_value": 26357.14,
  "new_customers": 3,
  "vs_previous_period": {
    "total_sales_pct": 12.4,
    "invoice_count_pct": -8.3
  },
  "pending_amount": 13400,
  "stock_on_hand": {
    "count": 58,
    "net_weight_g": 1120.5
  }
}
```

**Field sources:**
| Field | Source |
|---|---|
| `total_sales` | `sum(Invoice.grandTotal)` where `createdAt` in `[from, to]` |
| `invoice_count` | `count(Invoice)` in range |
| `items_sold` | `sum(Invoice.items[].pieces)` in range |
| `net_weight_sold_g` | `sum(Invoice.items[].netWtG)` in range |
| `avg_invoice_value` | `total_sales / invoice_count` (0 if `invoice_count` is 0) |
| `new_customers` | `count(Customer)` where `createdAt` in `[from, to]` |
| `vs_previous_period.*_pct` | `((current - previous) / previous) * 100`, rounded to 1dp; `null` if `previous` is 0. Previous period = the `N`-day window immediately preceding `from`, where `N = (to - from) + 1` days. |
| `pending_amount` | `sum(Invoice.pendingAmount)` where `paymentStatus != 'paid'` — **global, ignores `from`/`to`** |
| `stock_on_hand` | `count`/`sum(netWtG)` of `Tag` where `status: 'tagged'` — **global, ignores `from`/`to`** |

**Errors:** `401` (no/invalid token), `422` (missing/malformed/out-of-order/too-wide range)

---

### 2. `GET /api/dashboard/sales-trend`

**Query params:** `from=YYYY-MM-DD` (required), `to=YYYY-MM-DD` (required), same validation as `summary` (shared schema).

**Request:**
```
GET /api/dashboard/sales-trend?from=2026-10-14&to=2026-10-21
Authorization: Bearer <token>
```

**Response `200`:** array, one entry per calendar day in the range **inclusive, zero-filled for days with no invoices** (per `REQUIREMENTS.md`'s original note):
```json
[
  { "date": "2026-10-14", "total_sales": 92000 },
  { "date": "2026-10-15", "total_sales": 0 },
  { "date": "2026-10-16", "total_sales": 41200 }
]
```

**Errors:** `401`, `422` (same rules as `summary`)

---

## Backend implementation

- `src/schemas/dashboard.schema.ts` — `dashboardRangeQuerySchema`: `{ from: string, to: string }`, regex + `to >= from` + `<= 365` days, shared by both routes (a `.refine()` for the cross-field checks).
- `src/server/services/dashboardService.ts`:
  - `getDashboardSummary({ from, to })` — runs the current-period and previous-period aggregations (a single `Invoice.aggregate()` with `$facet` for both windows is cleanest — one round trip), plus the two global snapshot aggregations (`pending_amount` off `Invoice`, `stock_on_hand` off `Tag`) and the `new_customers` count off `Customer`. Returns the full shape above (already snake_case, so the route can `Response.json()` it directly — no separate `serialize*` needed, this isn't a stored document).
  - `getSalesTrend({ from, to })` — `Invoice.aggregate()` grouped by `$dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" }`, summing `grandTotal`; then zero-fills any date in `[from, to]` missing from the aggregation result before returning.
  - Both are pure read/aggregate — no transactions, no mutation, nothing session-scoped.
- `src/app/api/dashboard/summary/route.ts` — `GET`, 🔒.
- `src/app/api/dashboard/sales-trend/route.ts` — `GET`, 🔒.

No model changes. No changes to any existing route. `Invoice`, `Tag`, and `Customer` are read-only from this module's perspective.

**Status: built and manually verified** — see `docs/PROGRESS.md` for the verification results (401/422 edge cases, zero-fill, a real range cross-checked between both endpoints).

## Frontend

### Data hooks (`src/features/dashboard/hooks/`)

- `useDashboardSummary({ from, to })` — React Query, `queryKey: ["dashboard-summary", from, to]`, `apiClient.get` against `/dashboard/summary?from=&to=`. Same shape convention as `useInvoicesList.ts`.
- `useSalesTrend({ from, to })` — `queryKey: ["sales-trend", from, to]`, `apiClient.get` against `/dashboard/sales-trend?from=&to=`.
- Metal rate carousel needs **no new hook** — reuses `useMetalPurities()` (`src/features/settings/hooks/useMetalPurities.ts`), already built for Settings.
- Both new hooks are only ever called with a valid `{from, to}` (the page always has a default range before anything renders — see decision #9), so neither needs an `enabled` guard.

### New shared lib

- `src/lib/formatters.ts` (see decision #12) — `formatInr(value: number): string`, `formatWeight(grams: number): string` (`"42.300 g"`, 3dp to match the rest of the app's weight precision). Pulled out now so every new dashboard component shares one formatting source instead of each hand-rolling its own.

### Components (`src/features/dashboard/components/`)

- **`DateRangeFilter.tsx`** — pill buttons for the presets (Today / Yesterday / Last 7 Days / Last 30 Days / This Month) plus a "Custom" pill that reveals two `Input type="date"` fields (reusing the existing `Input` primitive, same pattern `InvoiceTable.tsx` already uses for its own date filter). Computes `{from, to}` as `YYYY-MM-DD` strings and calls `onChange({from, to})` — it holds no state of its own beyond which preset is active; the actual range lives in the page.
- **`KpiTiles.tsx`** — takes the resolved `DashboardSummary` and renders two visually separated groups (decision #11):
  - *Range-scoped* (shows a small ▲/▼ badge from `vs_previous_period`, green/red, or a neutral "—" dash when `null`): Total Sales, Invoices, Items Sold, Net Weight Sold, Avg Invoice Value, New Customers.
  - *As of now* (no badge, no range label — maybe a small "live" dot or just a visual gap/divider from the group above): Pending Amount, Stock on Hand (`count` + `net_weight_g`).
  - Each tile is a simple `panel`-styled `div` (no new `Card` primitive needed — matches how `InvoiceTable.tsx` already uses the `panel` class directly) with a Lucide icon, label, and value; loading state is a skeleton pulse per tile, error state is one inline message for the whole row (not per-tile) since all tiles come from one `useDashboardSummary()` call.
- **`SalesTrendChart.tsx`** — Recharts `ResponsiveContainer` + `LineChart` (or `BarChart` — pick during build, `LineChart` is the more natural fit for a daily trend), `XAxis` on `date`, `YAxis`/tooltip formatted via `formatInr()`. Reads from `useSalesTrend()` using the **same** `{from, to}` the KPI row uses. Empty state ("No sales in this range") instead of an empty chart when every point is zero.
- **`MetalRateCarousel.tsx`** — **revised twice after first build**, both times on direct user feedback. First: a plain `overflow-x-auto` scroll row left the browser's native scrollbar visible, read as unfinished rather than "classy" — replaced with `embla-carousel-react` (new dep — headless/unstyled, matching this project's hand-rolled-primitives convention) + `embla-carousel-autoplay`, giving rounded gold-accented prev/next arrows (disabled/greyed at the ends unless looping) and a gold glow on card hover (`shadow-[var(--shadow-gold)]`). Second: the user wanted it to always keep moving (autoplay's `stopOnMouseEnter` was pausing it) and then asked for **continuous slow drift instead of a discrete jump every N seconds** — `embla-carousel-autoplay` can't do that by design, so it was swapped for **`embla-carousel-auto-scroll`** (`speed: 1`, continuous pixel-by-pixel scrolling, never stops on hover or interaction); `embla-carousel-autoplay` was then removed as an unused dependency. Cards still come from `useMetalPurities({ includeInactive: false })`, filtered client-side to a non-null `rate_per_gram`. Each card: metal + purity, `formatInr(rate_per_gram)` + "/g", `formatDistanceToNow(updated_at)` for "updated 3h ago". No trend arrow (still no rate history). Two `react-hooks` lint rules (`refs`, `set-state-in-effect` — new, stricter rules shipped with this Next/eslint-config-next version) needed one lazy-`useState` fix and one scoped `eslint-disable-next-line` for Embla's documented React usage pattern, same precedent as the existing disables in `TagForm.tsx`/`MetalRateForm.tsx`.

### Page (`src/app/(app)/dashboard/page.tsx`)

Replaces the current placeholder entirely. Composition, top to bottom:
1. `MetalRateCarousel` (not range-scoped — always "right now," makes sense as the first thing a shopkeeper glances at)
2. `DateRangeFilter` (defaults to Last 7 Days on mount — decision #9)
3. `KpiTiles` (consumes `useDashboardSummary(range)`)
4. `SalesTrendChart` (consumes `useSalesTrend(range)`, same `range` state)
5. The existing `InvoiceTable` (unchanged, own independent date filter — decision #10), as a "recent invoices" section at the bottom, same component already used elsewhere — just imported here, not duplicated.

The page itself only owns the `range` `useState` and passes it down; no new store, no new context.

## Not building yet

- **Payment-mode split** (cash/upi/card/bank_transfer) and **metal-wise sales split** (Gold/Silver/Platinum revenue) — raised as "nice-to-have" donut chart ideas during design discussion, not committed to. If wanted later, likely a third endpoint (`GET /api/dashboard/breakdown?from=&to=`) rather than bloating `summary` further.
- **Metal-rate trend arrows** (up/down vs. the previous rate) for the carousel — `MetalPurity` only stores the current rate, no history. Would need a small `MetalRateHistory` write-path added to `PUT /api/metal-rates` purely for this. Deferred until actually requested.
- **Unifying `InvoiceTable`'s date filter with the new range filter** (decision #10) — would require changing `GET /api/invoices`'s contract; not requested, not pursued here.
- **Persisting the selected range** across reloads/navigation (decision #9) — plain in-memory state only, for now.

## Verification plan

### Backend — done, see `docs/PROGRESS.md` for results

1. `pnpm typecheck` / `pnpm lint` clean.
2. API via curl + a short-lived signed JWT, against real invoice data:
   - `summary`/`sales-trend` with no `from`/`to` → `422`; with `to < from` → `422`; with a >365-day span → `422`.
   - A range with zero invoices in it → `total_sales: 0`, `invoice_count: 0`, `avg_invoice_value: 0`, both `vs_previous_period` percentages `null` if the previous period was also empty.
   - `sales-trend` over a range spanning some days with invoices and some without → confirm zero-fill, confirm day count in the response matches `(to - from) + 1`, confirm the non-zero days sum to the same `total_sales` `summary` reports for the identical range.
   - `pending_amount`/`stock_on_hand` stay constant across different `from`/`to` values (proving they're global, not accidentally range-filtered).
   - Single-day range (`from === to`) works on both endpoints.

### Frontend — once built

1. `pnpm typecheck` / `pnpm lint` clean.
2. Manual browser walkthrough (Chrome extension, same approach as the billing module's Phase 11):
   - Each `DateRangeFilter` preset updates both `KpiTiles` and `SalesTrendChart` together, and only them — `InvoiceTable` below stays on its own independent date filter (decision #10).
   - Custom range: picking `from`/`to` manually produces the same data a matching preset would.
   - A range with no sales renders the "No sales in this range" empty state on the chart, not a blank chart; KPI tiles show `₹0.00` / `0`, not a crash.
   - `vs_previous_period` renders as a neutral dash, not `NaN%`/`null%`, when the API returns `null`.
   - Pending Amount / Stock on Hand visually read as "right now" and don't change when the date range is changed.
   - `MetalRateCarousel` scrolls smoothly on both desktop (mouse) and a touch/mobile viewport (Chrome device toolbar), shows only priced purities, and "updated X ago" matches the real `updated_at` from Settings.
   - Zero console errors throughout (same bar as the billing walkthrough).
