# Database Design & MongoDB Architecture

> **Architecture Decision Record (ADR):**
> MongoDB + Mongoose was already the chosen stack before this repo existed (see `docs/REQUIREMENTS.md`'s migration note) and is unchanged by the move to Next.js. All data is persisted in a document-based schema model optimized for fast lookups, atomic sequence increments, and ACID transactions where necessary.
>
> What *did* change: the connection is opened from `src/lib/db/mongoose.ts` and called at the top of every Route Handler (`await dbConnect()`), instead of once at Express server boot (`apps/api/src/app/server.ts` in the old repo). See the "Connection Lifecycle" note below — this matters because Next.js dev-mode hot-reloads route modules.

---

## 1. Database Connection & Config

- **Database Engine:** MongoDB 7.0+
- **ODM:** Mongoose 9.x (installed; API is unchanged from 8.x for everything used here)
- **Connection URI:** `mongodb://localhost:27017/jewellery_crm` (set via `MONGODB_URI` in `.env`, validated by `src/lib/env.ts`)
- **Connection helper:** `src/lib/db/mongoose.ts` — already implemented. Call `await dbConnect()` as the first line of every Route Handler that touches the database:

  ```typescript
  import { dbConnect } from "@/lib/db/mongoose";

  export async function GET() {
    await dbConnect();
    // ... query models
  }
  ```

### Connection Lifecycle (Next.js-specific)

Next.js reloads route modules on every file change in dev mode, which would open a new MongoDB connection pool per reload if the connection were created at module scope naively. `dbConnect()` caches the connection (and the in-flight connect promise) on `globalThis`, so repeated calls across hot reloads and across every route handler in the same process reuse one pool. This replaces what the old Express app did once in `server.ts` before calling `app.listen()`.

---

## 2. Collections & Schemas

No Mongoose model files exist yet in this repo (see `docs/PROGRESS.md` for the build-one-by-one plan) — the schemas below are the agreed design to implement when each module is built, unchanged from the original design.

### 2.1 `users`
Represents the single shopkeeper/admin account.
```typescript
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });
```
- **Indexes:** `{ email: 1 }` (unique)

---

### 2.2 `password_reset_tokens`
Ephemeral password reset tokens.
```typescript
const passwordResetTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // MongoDB TTL auto-cleanup
  usedAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });
```
- **Indexes:** `{ tokenHash: 1 }`, `{ expiresAt: 1 }` (TTL index)

---

### 2.3 `customers`
Customer profiles keyed by phone number for quick lookups during bill creation.
```typescript
const customerSchema = new Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true, index: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true },
}, { timestamps: true });
```
- **Indexes:** `{ phone: 1 }` (unique)

---

### 2.4 `tags`
Physical inventory articles with weights, metal purity, and barcode reference.
```typescript
const tagSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, index: true }, // e.g. "TAG-8K9QX2M4"
  productName: { type: String, required: true, trim: true },
  metal: { type: String, required: true }, // "Gold" | "Silver" | "Platinum"
  purity: { type: String, required: true }, // "22K" | "18K" | "24K" | "925"
  grossWtG: { type: Number, required: true, min: 0 },
  stoneWtG: { type: Number, required: true, min: 0, default: 0 },
  netWtG: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['tagged', 'sold'], default: 'tagged', index: true },
}, { timestamps: true });
```
- **Indexes:** `{ code: 1 }` (unique), `{ status: 1 }`

---

### 2.5 `invoices`
Tax invoice documents with embedded items and payments.
```typescript
const invoiceItemSchema = new Schema({
  srNo: { type: Number, required: true },
  tagCode: { type: String, ref: 'Tag', default: null },
  description: { type: String, required: true },
  hsnCode: { type: String, required: true },
  metal: { type: String, required: true },
  purity: { type: String, required: true },
  pieces: { type: Number, required: true, default: 1 },
  grossWtG: { type: Number, required: true },
  stoneWtG: { type: Number, required: true, default: 0 },
  netWtG: { type: Number, required: true },
  ratePerGram: { type: Number, required: true },
  makingCharge: { type: Number, required: true, default: 0 },
  stoneCharge: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true },
}, { _id: false });

const invoicePaymentSchema = new Schema({
  amount: { type: Number, required: true },
  mode: { type: String, enum: ['cash', 'upi', 'card', 'bank_transfer'], required: true },
  paidAt: { type: Date, default: Date.now },
}, { _id: false });

const invoiceSchema = new Schema({
  invoiceNo: { type: String, required: true, unique: true, index: true }, // "INV-2026-0231"
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    address: String,
  },
  items: [invoiceItemSchema],
  payments: [invoicePaymentSchema],
  subtotal: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  gstPercent: { type: Number, required: true, default: 3 },
  gstAmount: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  paidAmount: { type: Number, required: true, default: 0 },
  pendingAmount: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid', index: true },
}, { timestamps: true });
```
- **Indexes:** `{ invoiceNo: 1 }` (unique), `{ customerId: 1 }`, `{ createdAt: -1 }`, `{ paymentStatus: 1 }`

---

### 2.6 `invoice_counters`
Atomic sequence increment table for collision-free sequential invoice generation:
```typescript
const invoiceCounterSchema = new Schema({
  _id: { type: Number, required: true }, // Financial year, e.g. 2026
  lastNumber: { type: Number, required: true, default: 0 },
});
```

#### Atomic Counter Generation in Mongoose:
```typescript
export async function getNextInvoiceNumber(financialYear: number): Promise<string> {
  const counter = await InvoiceCounterModel.findByIdAndUpdate(
    financialYear,
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true }
  );
  const sequenceStr = String(counter.lastNumber).padStart(4, '0');
  return `INV-${financialYear}-${sequenceStr}`;
}
```

---

## 3. Transactions & Data Integrity

1. **Invoice Finalization (`POST /api/invoices`):**
   - Execute in a Mongoose session transaction (`session = await mongoose.startSession()`).
   - Atomically increment `InvoiceCounter`.
   - Update all scanned tags to `status: 'sold'`.
   - Upsert customer record.
   - Insert new invoice document.
2. **Invoice Deletion (`DELETE /api/invoices/:id`):**
   - Find invoice by ID.
   - Extract all `items[].tagCode` (ignoring nulls).
   - Revert tags to `status: 'tagged'` with `{ code: { $in: tagCodes } }`.
   - Delete invoice document.

> **Note on Mongoose transactions in serverless/edge deployments:** `mongoose.startSession()` transactions require a replica set (even a single-node one — `mongod --replSet rs0`) and the **Node.js runtime**, not the Edge runtime. Every Route Handler using transactions must not set `export const runtime = 'edge'` (the default is already `nodejs`, so this only matters if it's ever overridden).

---

## 4. Validation Schemas (Zod v4)

The original design shared Zod schemas between the Express backend and the React frontend via `packages/shared`. In this single Next.js app there is no package boundary to cross — one schema file in `src/schemas/` is imported by both a Route Handler (server) and a React Hook Form resolver (client) directly.

This repo has **Zod v4** installed (`"zod": "^4.6.7"`), not v3 as the original docs assumed. Basic `z.object()/z.string()/z.number()` usage is unchanged, but check the [Zod v4 migration notes](https://zod.dev/v4) before writing a schema that uses `.email()`, custom error messages (`message` → `error` in some APIs), or `AnyZodObject`-style generic typing, since those changed.
