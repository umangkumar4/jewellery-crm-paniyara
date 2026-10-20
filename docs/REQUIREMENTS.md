# Jewellery CRM & POS — System Requirements Specification

> **Notice on Stack Choice:**
> This project was originally scaffolded as a pnpm monorepo with a separate React/Vite SPA (`apps/web`) and an Express/Node API (`apps/api`), both documented in a sibling repo at `jewellery-crm/`. It has since been **rebuilt as a single Next.js (App Router) application** — see `docs/PROGRESS.md` for why and what carried over. The database choice is unchanged: **MongoDB with Mongoose**. All relational-table language from any older draft is implemented as MongoDB collections with Mongoose schemas and atomic document operations.
>
> This repo is a fresh start — it does not share git history, `node_modules`, or source with the old `jewellery-crm/apps/*` folders. Nothing there was modified.

---

## 1. System Overview & Purpose

The **Jewellery CRM & POS** platform is an enterprise-grade retail and billing management system built for jewellery operations. It covers article-level barcode tagging, fast POS barcode billing, customer lookup and purchase ledgers, partial payment collection, and sales analytics.

### Core Objectives:
1. **Article Tagging & Barcodes:** Unique, collision-checked physical tag codes (`TAG-XXXXXXXX`) with barcode/QR generation and printing capabilities.
2. **Instant Billing / POS:** High-speed barcode scanning input, automatic retrieval of purity/weights/charges, customer lookup by phone, and support for split/partial payments with accurate GST calculations.
3. **Traceable Inventory:** Real-time tag status management (`tagged` ➔ `sold`), preventing duplicate sales or double-billing.
4. **Daily Analytics & Cash Flow:** Real-time KPI tiles (sales, invoice counts, pending balances) with previous-day comparisons and trend graphs.
5. **MongoDB Native Architecture:** Clean Mongoose document schemas, transactional safety, and atomic sequence counters for sequential invoice numbering (`INV-YYYY-XXXX`).

---

## 2. Tech Stack

The frontend and backend are **one Next.js application** — pages and API routes live in the same project, deploy together, and share one `src/` tree. There is no separate Express server and no CORS boundary between "frontend" and "backend"; see `docs/bckend_setup.md` (kept as the API/Route-Handler reference) and `docs/frontend_setup.md` (kept as the App Router/UI reference) for the split in *documentation*, not in deployment units.

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16 (App Router, TypeScript)** | Full-stack: server-rendered pages + REST-shaped API Route Handlers, one codebase, one deploy |
| **Styling & Components** | Tailwind CSS v4 + Lucide Icons | Responsive, high-contrast POS UI |
| **Server State (client)** | TanStack React Query (`@tanstack/react-query`) | API data caching, polling, mutation handling in client components |
| **Client State** | Zustand | Local draft session, scanner inputs, filter persistence |
| **Forms & Validation** | Zod v4 (shared between Route Handlers and client forms, same file) + React Hook Form | Strict schema validation, single source of truth — no separate frontend/backend schema copies |
| **Database** | **MongoDB (v7.0+) with Mongoose (v9.x)** | Primary transactional document database |
| **Authentication** | JWT returned in the login response body, stored client-side in `sessionStorage`, sent back as an `Authorization: Bearer <token>` header | Single-user shopkeeper session with bcrypt hashing |
| **HTTP client (browser → own API)** | Native `fetch` via `src/lib/api-client.ts` | Same-origin requests to `/api/*` — no axios, no CORS config needed |
| **Logging & Utilities** | Pino + Zod | Structured request logs and input sanitation |
| **Printing & Barcodes** | `jsbarcode` / `qrcode.react` / HTML Print Views | In-browser client-rendered labels and invoices |

**Deliberately dropped** when moving to Next.js (all now redundant, not replaced by anything):
- `express`, `cookie-parser`, `cors`, `helmet`, `express-rate-limit` — a Route Handler *is* the server; no separate HTTP server, no cross-origin requests to protect against.
- `axios` — same-origin `fetch` with `credentials: "same-origin"` does everything the old interceptor did.
- A build/dev split (`vite` for web, `tsx watch` for api) — `next dev` / `next build` cover both.

**No testing libraries are installed or planned** (explicit project requirement — no Vitest, Jest, Supertest, or Testing Library).

---

## 3. MongoDB Database Schema Design

Unchanged from the original design — see `docs/DATABASE_DESIGN.md` for full Mongoose schema definitions, indexes, and transaction logic. Summary of the 6 collections:

### 3.1 `users` Collection
Stores the shopkeeper's authentication credentials. Single-account model.
```typescript
interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;              // unique, lowercase, trimmed
  passwordHash: string;       // bcrypt hash
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 `password_reset_tokens` Collection
Stores hashed password reset tokens with automatic TTL expiration.
```typescript
interface PasswordResetTokenDocument {
  _id: ObjectId;
  userId: ObjectId;           // ref: 'User'
  tokenHash: string;          // sha256 or bcrypt hash
  expiresAt: Date;            // indexed with TTL (30 minutes)
  usedAt?: Date | null;
  createdAt: Date;
}
```

### 3.3 `customers` Collection
Customer registry indexed by unique phone number for fast cashier lookups.
```typescript
interface CustomerDocument {
  _id: ObjectId;
  name: string;
  phone: string;              // unique index, trimmed
  email?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.4 `tags` Collection
Unique article-level stock items generated for barcode printing.
```typescript
export type TagStatus = 'tagged' | 'sold';

interface TagDocument {
  _id: ObjectId;
  code: string;               // unique index, e.g. "TAG-8K9QX2M4"
  productName: string;
  metal: string;              // e.g. "Gold", "Silver", "Platinum"
  purity: string;             // e.g. "22K", "18K", "925"
  grossWtG: number;           // gross weight in grams (Decimal precision)
  stoneWtG: number;           // stone/non-metal weight
  netWtG: number;             // net pure metal weight
  status: TagStatus;          // 'tagged' | 'sold', default: 'tagged'
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.5 `invoices` Collection
Financial record of customer sales with embedded line items and payment entries.
```typescript
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type PaymentMode = 'cash' | 'upi' | 'card' | 'bank_transfer';

interface InvoiceItemSubdocument {
  srNo: number;
  tagCode?: string | null;    // reference to Tag.code if scanned
  description: string;
  hsnCode: string;            // e.g. "7113"
  metal: string;
  purity: string;
  pieces: number;
  grossWtG: number;
  stoneWtG: number;
  netWtG: number;
  ratePerGram: number;
  makingCharge: number;
  stoneCharge: number;
  total: number;              // (netWtG * ratePerGram) + makingCharge + stoneCharge
}

interface InvoicePaymentSubdocument {
  amount: number;
  mode: PaymentMode;
  paidAt: Date;
}

interface InvoiceDocument {
  _id: ObjectId;
  invoiceNo: string;          // unique index, e.g. "INV-2026-0231"
  customerId: ObjectId;       // ref: 'Customer'
  customer: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  items: InvoiceItemSubdocument[];
  payments: InvoicePaymentSubdocument[];
  subtotal: number;
  discountAmount: number;     // flat ₹ discount
  gstPercent: number;         // e.g. 3.0
  gstAmount: number;
  grandTotal: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.6 `invoice_counters` Collection
Provides race-condition-free, atomic sequential invoice numbering per financial year:
```typescript
interface InvoiceCounterDocument {
  _id: number;                // Financial Year as primary key (e.g., 2026)
  lastNumber: number;         // incremented atomically via findOneAndUpdate with $inc
}
```

---

## 4. API Endpoints Specification (17 Routes)

All routes are mounted at `/api` — **unchanged paths**, now implemented as Next.js Route Handlers (`src/app/api/**/route.ts`) instead of Express controllers. See `docs/bckend_setup.md` for the Route Handler implementation convention.

- 🔒 = Protected. The client sends `Authorization: Bearer <token>`; the check happens **inside the route handler** itself (a `requireAuth()` call) — see the Auth note in `bckend_setup.md`.
- 🔓 = Public endpoint.
- 🔑 = Protected by `X-Setup-Secret` header matching `SETUP_SECRET` environment variable.

### 4.1 Authentication Module

#### `1. POST /api/auth/login` 🔓
- **Purpose:** Verifies email and password, creates an authenticated session.
- **Request Body:**
  ```json
  { "email": "owner@shop.com", "password": "password123" }
  ```
- **Response (200):** Returns the JWT in the body — no cookie is set.
  ```json
  { "user": { "id": "...", "name": "Ramesh Shah", "email": "owner@shop.com" }, "token": "<jwt>" }
  ```
  The frontend stores `token` in `sessionStorage` and attaches it as `Authorization: Bearer <token>` on every subsequent request (see `docs/frontend_setup.md`).
- **Errors:** `401 Unauthorized` (`{ "error": "Invalid email or password" }`).

#### `2. POST /api/auth/logout` 🔒
- **Purpose:** Symmetry endpoint for the client's logout flow. Since the JWT is stateless and lives only in the browser's `sessionStorage` (never a cookie), there is no server-side session to clear — "logging out" is really just the frontend calling `clearStoredToken()`. This endpoint exists for consistency with the REST contract and as a hook for future token revocation (e.g. a blacklist) if that's ever needed; until then it can just acknowledge the request.
- **Response (200):** `{ "message": "Logged out" }`.

#### `3. POST /api/auth/forgot-password` 🔓
- **Purpose:** Generates a 30-minute password reset token, hashes it in DB, and dispatches reset URL via email.
- **Request Body:** `{ "email": "owner@shop.com" }`
- **Response (200):** `{ "message": "If that email is registered, a reset link has been sent." }`

#### `4. POST /api/auth/reset-password` 🔓
- **Purpose:** Consumes the valid reset token and updates user password hash.
- **Request Body:** `{ "token": "raw-token-here", "new_password": "newSecurePassword123" }`
- **Response (200):** `{ "message": "Password updated. Please log in." }`
- **Errors:** `400 Bad Request` if token is expired, invalid, or already used.

#### `17. POST /api/auth/register` 🔑
- **Purpose:** One-time initial setup endpoint to bootstrap the first administrator user.
- **Headers:** `X-Setup-Secret: <SETUP_SECRET>`
- **Request Body:** `{ "name": "Owner", "email": "owner@shop.com", "password": "securePass" }`
- **Response (201):** `{ "user": { "id": "...", "name": "Owner", "email": "owner@shop.com" } }`
- **Errors:** `409 Conflict` if a user record already exists in database.

---

### 4.2 Dashboard & Reporting Module

#### `5. GET /api/dashboard/summary?date=YYYY-MM-DD` 🔒
- **Purpose:** Summary KPI tiles for selected date with day-over-day percentage changes.
- **Response (200):**
  ```json
  {
    "date": "2026-09-15",
    "total_sales": 184500,
    "invoice_count": 7,
    "items_sold": 11,
    "pending_amount": 13400,
    "vs_previous_day": { "total_sales_pct": 12.4, "invoice_count_pct": -8.3 }
  }
  ```

#### `6. GET /api/dashboard/sales-trend?from=YYYY-MM-DD&to=YYYY-MM-DD` 🔒
- **Purpose:** Daily sales trend coordinates for charts (zero-sales days included).
- **Response (200):**
  ```json
  [
    { "date": "2026-09-08", "total_sales": 92000 },
    { "date": "2026-09-09", "total_sales": 0 }
  ]
  ```

---

### 4.3 Invoices & Billing Module

#### `7. GET /api/invoices?page=1&limit=20&date=YYYY-MM-DD` 🔒
- **Purpose:** Paginated list of invoices for management table.
- **Response (200):**
  ```json
  {
    "data": [
      {
        "id": "...",
        "invoice_no": "INV-2026-0231",
        "customer_name": "Priya Mehta",
        "phone": "9812345678",
        "items_count": 1,
        "grand_total": 50830.5,
        "paid_amount": 700,
        "pending_amount": 50130.5,
        "payment_status": "partial",
        "created_at": "2026-09-13T11:42:00Z"
      }
    ],
    "total": 1,
    "page": 1
  }
  ```

#### `8. GET /api/invoices/:id` 🔒
- **Purpose:** Full invoice details with customer, line items, and payment transactions.
- **Response (200):** Complete invoice object.

#### `9. GET /api/invoices/:id/print` 🔒
- **Purpose:** Standardized printable view data for bill receipt generation.

#### `10. DELETE /api/invoices/:id` 🔒
- **Purpose:** Hard-deletes an invoice and automatically reverts all its associated scanned tags back to `status: 'tagged'`.
- **Response (200):**
  ```json
  {
    "message": "Invoice INV-2026-0231 and its records were deleted",
    "reverted_tags": ["TAG-04821"]
  }
  ```

#### `11. GET /api/customers?phone=9812345678` 🔒
- **Purpose:** Instant customer profile lookup by mobile number during POS billing.
- **Response (200):** `{ "id": "...", "name": "Priya Mehta", "email": "...", "address": "..." }`
- **Errors:** `404 Not Found` if customer does not exist yet (expected for first-time walk-ins).

#### `12. POST /api/invoices` 🔒
- **Purpose:** Atomically commits invoice, assigns sequential `invoiceNo`, creates/updates customer, and transitions tag statuses to `sold`.
- **Request Body:**
  ```json
  {
    "customer": {
      "name": "Priya Mehta",
      "phone": "9812345678",
      "email": "priya@example.com",
      "address": "12 MG Road, Pune"
    },
    "items": [
      {
        "description": "Gold Ring - floral",
        "hsn_code": "7113",
        "metal": "Gold",
        "purity": "22K",
        "pieces": 1,
        "gross_wt_g": 8.2,
        "stone_wt_g": 0.6,
        "net_wt_g": 7.6,
        "rate_per_gram": 6250,
        "making_charge": 1800,
        "stone_charge": 500,
        "tag_code": "TAG-04821",
        "total": 49850
      }
    ],
    "discount_amount": 500,
    "gst_percent": 3,
    "gst_amount": 1480.5,
    "subtotal": 49850,
    "grand_total": 50830.5,
    "payment": { "amount": 700, "mode": "cash" },
    "paid_amount": 700,
    "pending_amount": 50130.5,
    "payment_status": "partial"
  }
  ```
- **Response (201):**
  ```json
  {
    "invoice_id": "...",
    "invoice_no": "INV-2026-0231",
    "created_at": "2026-09-15T11:42:00Z"
  }
  ```

#### `13. POST /api/invoices/:id/payments` 🔒
- **Purpose:** Appends a payment collection record and recalculates pending balance and status.
- **Request Body:**
  ```json
  {
    "amount": 1300,
    "mode": "upi",
    "paid_amount": 2000,
    "pending_amount": 0,
    "payment_status": "paid"
  }
  ```
- **Response (200):** `{ "invoice_id": "...", "saved": true }`

---

### 4.4 Tagging Module

#### `14. POST /api/tags` 🔒
- **Purpose:** Creates a physical inventory tag, generates opaque code `TAG-XXXXXXXX`, and readies it for printing.
- **Request Body:**
  ```json
  {
    "product_name": "Gold Ring - floral",
    "metal": "Gold",
    "purity": "22K",
    "gross_wt_g": 8.2,
    "stone_wt_g": 0.6,
    "net_wt_g": 7.6
  }
  ```
- **Response (201):**
  ```json
  {
    "id": "...",
    "code": "TAG-7K9QX2M4",
    "product_name": "Gold Ring - floral",
    "metal": "Gold",
    "purity": "22K",
    "gross_wt_g": 8.2,
    "stone_wt_g": 0.6,
    "net_wt_g": 7.6,
    "status": "tagged",
    "created_at": "2026-09-15T09:12:00Z"
  }
  ```

#### `15. GET /api/tags/:code/label` 🔒
- **Purpose:** Label preview payload formatted specifically for barcode/thermal label printers.

#### `16. GET /api/tags/:code` 🔒
- **Purpose:** Scan lookup triggered by barcode reader during POS billing.
- **Errors:**
  - `404 Not Found`: No tag with this code.
  - `409 Conflict`: Tag has already been sold (`status: 'sold'`).

---

## 5. Architectural Invariants & Business Rules

1. **Client-Side Authoritative Math:**
   Per POS requirements, item line calculations (`total = net_wt_g * rate_per_gram + making_charge + stone_charge`), subtotal, discounts, and GST are calculated client-side in a centralized pure calculation module (`src/features/billing/lib/calculations.ts`) and validated by the backend.
2. **Atomic Invoice Numbers:**
   `invoice_counters` handles sequence numbers atomically (`INV-YYYY-XXXX`) per financial year.
3. **Double-Sale Prevention:**
   A tag can only be billed if `status === 'tagged'`. Scans of already sold pieces are immediately rejected with HTTP 409.
4. **Cascade Rollback on Delete:**
   Deleting an invoice frees up all associated tags back to `tagged` status so physical pieces can be re-inventoried if an invoice was made in error.
5. **No Negative Pending Balances:**
   Payments are validated to ensure total paid cannot exceed the invoice grand total.
6. **Auth is enforced per-route, via an `Authorization` header, not a cookie:**
   The JWT lives only in the browser's `sessionStorage` and is attached as `Authorization: Bearer <token>` by `src/lib/api-client.ts`. The server never sees it on a plain page navigation — only on an explicit `fetch` call. Every 🔒 Route Handler independently verifies that header via `requireAuth()`. This also means `proxy.ts`'s originally-planned "redirect to /login if no session cookie" trick doesn't work here — there's no cookie for the server to see — so protected **pages** need a client-side auth gate instead (check `sessionStorage` after mount, redirect if empty). See `docs/bckend_setup.md §6`.
