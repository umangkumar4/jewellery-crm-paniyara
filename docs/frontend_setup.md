# Jewellery CRM & POS — Frontend Setup Guide (App Router)

This document is the authoritative specification for the UI half of this Next.js app — the `src/app/**/page.tsx` tree, client components, client-side state, POS barcode scanning, billing calculations, and printable views. The API half lives in the same `src/app/api/**/route.ts` tree — see `docs/bckend_setup.md`.

> **No separate frontend origin:** there is no `VITE_API_BASE_URL` or cross-origin fetch. Client components call `/api/*` on the same origin via `src/lib/api-client.ts` (a thin `fetch` wrapper), and the httpOnly session cookie travels automatically.
>
> **No testing libraries** — no React Testing Library, no Vitest, per project requirement (unchanged from the original spec, which already excluded it).

---

## 1. Frontend Tech Stack

| Tool / Library | Role | Status |
|---|---|---|
| **Next.js 16 (App Router)** | Routing, Server + Client Components | ✅ installed |
| **TypeScript** | Type safety | ✅ installed |
| **Tailwind CSS v4** | Styling (`@theme inline` token syntax — different from v3's `tailwind.config.js` theme object) | ✅ installed, default theme |
| **React Query (`@tanstack/react-query`)** | Server state in client components — fetching, caching, mutations | ✅ installed, `QueryClientProvider` wired in `src/app/providers.tsx` |
| **Zustand** | Client state — session UI state, POS draft (unsubmitted scanned items) | ✅ installed, no stores written yet |
| **React Hook Form + Zod + `@hookform/resolvers`** | Forms — dynamic item grids, validated against the *same* Zod schema the Route Handler uses | ✅ installed |
| **`jsbarcode` & `qrcode.react`** | Tag barcode/QR rendering, drawn client-side, no server round trip | ✅ installed |
| **Recharts** | Dashboard sales trend chart | ✅ installed |
| **`date-fns`** | Date math for dashboard filters | ✅ installed |
| **`sonner`** | Toast notifications | ✅ installed, `<Toaster />` wired in `src/app/providers.tsx` |
| **`clsx` + `tailwind-merge`** | `cn()` helper | ✅ installed, `src/lib/utils.ts` |
| **`lucide-react`** | Icons | ✅ installed |

**Not installed, deliberately:** `react-router-dom` (the App Router *is* the router — file-system based, no manual route table), `axios` (same-origin `fetch`, see `src/lib/api-client.ts`).

---

## 2. What's Already Built (this session)

```
src/app/
├── layout.tsx         Root layout — Geist fonts, wraps children in <Providers>
├── providers.tsx       'use client' — QueryClientProvider + <Toaster richColors />
├── globals.css          Tailwind v4 import + CSS variable theme tokens
├── page.tsx             Temporary landing page — shows MongoDB connection status via /api/health.
│                        Replace this once the dashboard or /login exists; it has no real product value.
└── api/health/route.ts  Infra health check, not a product feature
```

Everything else below is **not started** — it's the agreed plan for when each feature is built, so the next AI session (or you) doesn't have to re-derive the directory convention from scratch.

---

## 3. Directory & Folder Structure (Target)

Organized by feature, same mental model as the original React app, adapted to the App Router's file-system routing:

```
src/
├── app/
│   ├── layout.tsx                     ✅ done
│   ├── providers.tsx                  ✅ done
│   ├── page.tsx                       ✅ placeholder — swap for a redirect to /dashboard or /login once auth exists
│   ├── globals.css                    ✅ done
│   │
│   ├── (auth)/                         Route group — unauthenticated, no shared chrome
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   │
│   ├── (app)/                          Route group — authenticated, shares one layout
│   │   ├── layout.tsx                   AppShell (nav/topbar) + session check; redirect('/login') if no valid cookie
│   │   ├── dashboard/page.tsx
│   │   ├── billing/page.tsx
│   │   ├── tagging/page.tsx
│   │   └── invoices/
│   │       ├── page.tsx                  ledger table
│   │       └── [id]/
│   │           ├── page.tsx               invoice detail / view bill modal equivalent
│   │           └── print/page.tsx         print-only layout, calls window.print()
│   │
│   └── api/                            See docs/bckend_setup.md
│
├── features/                           Client-side only: hooks + components grouped by feature, imported into app/ pages
│   ├── auth/
│   │   ├── hooks/useAuth.ts              React Query mutations: login, logout, forgotPassword, resetPassword
│   │   └── components/LoginForm.tsx, ForgotPasswordForm.tsx, ResetPasswordForm.tsx
│   ├── dashboard/
│   │   ├── hooks/useDashboardSummary.ts, useSalesTrend.ts, useInvoicesList.ts
│   │   └── components/KpiTiles.tsx, SalesTrendChart.tsx, DateRangeFilter.tsx, InvoiceTable.tsx, DeleteInvoiceDialog.tsx
│   ├── billing/
│   │   ├── hooks/useCustomerLookup.ts, useCreateInvoice.ts, useAddPayment.ts
│   │   ├── lib/calculations.ts           pure functions, see §4 — copy verbatim from the original design, framework-independent
│   │   └── components/CustomerFields.tsx, ScanInput.tsx, ItemTable.tsx, TotalsPanel.tsx, PaymentPanel.tsx
│   └── tagging/
│       ├── hooks/useCreateTag.ts
│       └── components/TagPrintingForm.tsx, TagLabelPreview.tsx
│
├── store/                              Zustand stores
│   ├── useAuthStore.ts                   client-known auth state (e.g. current user name for the topbar) — the actual session lives in the httpOnly cookie, this is just UI convenience state
│   └── useBillingStore.ts                in-progress POS draft: scanned items, customer fields, before submit
│
├── components/
│   ├── ui/                              Button, Input, Table, Dialog, Select, Badge, Card — hand-rolled Tailwind components. No shadcn CLI is installed; add it only if asked, otherwise build these directly since the original spec's dependency list never included it despite the sibling gpnk-jewellers-pos-setup-guide.md draft mentioning it.
│   └── layout/AppShell.tsx               Top bar + nav tabs + outlet, used by app/(app)/layout.tsx
│
├── schemas/, server/, models/          See docs/bckend_setup.md
│
└── lib/
    ├── api-client.ts                    ✅ done — fetch wrapper, replaces axios
    ├── utils.ts                          ✅ done — cn()
    ├── env.ts, logger.ts, db/mongoose.ts ✅ done — server-side infra, see docs/bckend_setup.md
    └── formatters.ts                     not started — currency (₹), weight (g), date formatting helpers
```

---

## 4. Pure Calculation Module (`src/features/billing/lib/calculations.ts`)

Unchanged from the original design — framework-independent, so it ports verbatim. All billing formulas run client-side for offline resilience at the counter; the backend validates structure but does not recompute (see `REQUIREMENTS.md §5.1`).

```typescript
export interface LineItemCalculationInput {
  netWtG: number;
  ratePerGram: number;
  makingCharge: number;
  stoneCharge: number;
}

/**
 * total = (netWtG * ratePerGram) + makingCharge + stoneCharge
 */
export function calculateItemTotal(item: LineItemCalculationInput): number {
  const metalValue = Math.round(item.netWtG * item.ratePerGram);
  const total = metalValue + Math.round(item.makingCharge) + Math.round(item.stoneCharge);
  return total;
}

/**
 * taxableAmount = subtotal - discountAmount
 * gstAmount = taxableAmount * (gstPercent / 100)
 * grandTotal = taxableAmount + gstAmount
 */
export function calculateInvoiceTotals(
  items: { total: number }[],
  discountAmount: number = 0,
  gstPercent: number = 3.0,
): {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  grandTotal: number;
} {
  const subtotal = items.reduce((sum, it) => sum + it.total, 0);
  const safeDiscount = Math.min(discountAmount, subtotal);
  const taxableAmount = Math.max(0, subtotal - safeDiscount);
  const gstAmount = Math.round((taxableAmount * gstPercent) / 100 * 100) / 100;
  const grandTotal = Math.round(taxableAmount + gstAmount);

  return { subtotal, discountAmount: safeDiscount, taxableAmount, gstAmount, grandTotal };
}

export function calculateNewPending(
  grandTotal: number,
  paidAmount: number,
): { pendingAmount: number; paymentStatus: 'unpaid' | 'partial' | 'paid' } {
  const pendingAmount = Math.max(0, grandTotal - paidAmount);
  let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';

  if (paidAmount >= grandTotal) {
    paymentStatus = 'paid';
  } else if (paidAmount > 0) {
    paymentStatus = 'partial';
  }

  return { pendingAmount, paymentStatus };
}
```

---

## 5. POS Barcode Scanning Flow (`ScanInput.tsx`, when built)

Unchanged behavior from the original design:

1. Physical USB/Bluetooth barcode guns type the tag code (e.g. `TAG-7K9QX2M4`) and terminate with `Enter`, behaving as a keyboard emulator.
2. `ScanInput.tsx` maintains auto-focus. On `Enter`, it calls `apiClient.get('/tags/' + code)` (→ `GET /api/tags/:code`).
   - **200:** append to `useBillingStore`'s draft items, recalculate totals, play a scan confirmation chime.
   - **409:** `sonner` error toast — "This tag has already been sold."
   - **404:** `sonner` error toast — "Tag code not recognized."

---

## 6. Physical Label & Invoice Printing

### 6.1 Tag Barcode Printing (`TagLabelPreview.tsx`)
Unchanged — `jsbarcode` on canvas/SVG:
```tsx
import JsBarcode from 'jsbarcode';
// JsBarcode("#barcode", tag.code, { format: "CODE128", width: 1.5, height: 40 });
```
Styled with `@media print` rules in `globals.css`, matched to standard thermal jewellery labels (e.g., 50mm × 12mm butterfly dumbbell tags).

### 6.2 Invoice Printing (`app/(app)/invoices/[id]/print/page.tsx`)
Pulls data via `GET /api/invoices/:id/print`. Since this is a Server Component page by default, fetch the data server-side (`await dbConnect()` isn't available to a page directly — call the route's service function, or `fetch` the route itself) and render a clean tabular receipt (Shop Header, Customer details, itemized breakdown, Paid vs. Pending, Payment Mode). Trigger `window.print()` from a small client component once the content is mounted.

---

## 7. Fetch Client (`src/lib/api-client.ts`) — ✅ already built

```typescript
export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
}

export const apiClient = {
  get:    <T>(path: string) => request<T>(path, { method: "GET" }),
  post:   <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: ... }),
  patch:  <T>(path: string, data?: unknown) => request<T>(path, { method: "PATCH", body: ... }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
```

Replaces the old axios instance + response interceptor. Same behavior: `credentials: "same-origin"` sends the httpOnly cookie, and a `401` redirects to `/login` (except when already on `/login`, to avoid a loop). Use `ApiError` (has `.status` and optional `.fields`) to branch UI error handling instead of checking `error.response?.status` like the old axios code did.

---

## 8. Development Scripts & Running

```bash
pnpm dev         # http://localhost:3000 — serves pages AND /api/* together
pnpm build       # type-checks + production build
pnpm start       # run the production build
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
```
