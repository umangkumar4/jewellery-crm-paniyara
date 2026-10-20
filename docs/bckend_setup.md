# Jewellery CRM & POS — Backend Setup Guide (Next.js Route Handlers)

> **Database:** MongoDB (v7.0+) with Mongoose (v9.x) — unchanged from the original design.
> **Framework:** There is no separate Express app. The "backend" is the `src/app/api/**/route.ts` tree of this same Next.js project. This file documents how that tree is organized and the conventions every route must follow.

Hand this file (together with `REQUIREMENTS.md` and `DATABASE_DESIGN.md`) to any AI agent before implementing an endpoint — it has the exact request/response shape, status codes, Mongoose models, and the Next.js-16-specific gotchas that aren't obvious from training data.

---

## 0. Read this before writing a Route Handler

This project was scaffolded on **Next.js 16.4.2**, which has two breaking changes from what most training data assumes:

1. **`middleware.ts` is renamed `proxy.ts`.** Same capabilities, different file/export name. **Not planned for auth anymore** in this repo — see §6, the token lives in `sessionStorage`, not a cookie, so the server can't see it on a page navigation for `proxy.ts` to check.
2. **Dynamic route `params` are a `Promise`, not an object.** `{ params }: { params: Promise<{ id: string }> }`, then `const { id } = await params;`. This has been true since v15 but is easy to get wrong from memory.
3. **Cache Components (the new default caching model) is turned OFF in `next.config.ts`.** The create-next-app default (`cacheComponents: true`) makes every page static-by-default and requires `<Suspense>` boundaries around anything that reads cookies, the database, or request data. For an always-dynamic, always-authenticated internal tool like this one, that model fights the app's actual shape — every page needs live data. We disabled it, which reverts to the classic model: Route Handlers are **not cached by default** (matches the old Express mental model exactly) and pages reading `cookies()` just become dynamic, no Suspense gymnastics required. If a genuinely static/public page is ever added, re-read `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` before re-enabling it.
4. Run `grep -r "cacheComponents" next.config.ts` to confirm this is still `false`/absent before assuming the classic model applies — a future `next upgrade` could reset it.

Next.js ships its own current docs in this repo at `node_modules/next/dist/docs/` — when in doubt about an API introduced after your training cutoff, read the actual `.md` file there before guessing.

---

## Conventions

- **Base URL:** `/api` (e.g. `http://localhost:3000/api` in dev — one server, one port, no separate API origin).
- **Auth:** 🔒 = requires a valid `Authorization: Bearer <token>` header. There is **no cookie** — the JWT is returned in the login response body and stored client-side (`sessionStorage`, `src/lib/auth-token.ts`), attached to every request by `src/lib/api-client.ts`. **Every** 🔒 route handler calls `requireAuth()` itself to verify that header — see §6. 🔓 = public, no `Authorization` header required.
- **Content type:** `application/json` for all request and response bodies.
- **Dates:** ISO 8601 with timezone, e.g. `2026-09-15T11:42:00Z`. Date-only filters use `YYYY-MM-DD`.
- **Money & weight:** JSON numbers — treat as fixed-precision decimals end to end. Never let JS float round a ₹ amount or gram weight.
- **Errors:** non-2xx returns `{ "error": "<message>" }`. Validation failures return `422` with `{ "error": "Validation failed", "fields": { "<field>": "<message>" } }`.
- **Pagination:** `?page=` (1-indexed) and `?limit=` (default 20), returning `{ "data": [...], "total": <int>, "page": <int> }`.

---

## Endpoint Index

| # | Method | Path | Auth | Module | Summary |
|---|---|---|---|---|---|
| 1 | POST | `/api/auth/register` | 🔓 (setup secret) | Auth | One-time account creation |
| 2 | POST | `/api/auth/login` | 🔓 | Auth | Verify credentials, return JWT in the response body |
| 3 | POST | `/api/auth/logout` | 🔒 | Auth | Acknowledge only — client clears its own `sessionStorage` token |
| 4 | POST | `/api/auth/forgot-password` | 🔓 | Auth | Issue a reset token |
| 5 | POST | `/api/auth/reset-password` | 🔓 | Auth | Consume token, set new password |
| 6 | GET | `/api/dashboard/summary` | 🔒 | Dashboard | KPI tiles (today vs. yesterday) |
| 7 | GET | `/api/dashboard/sales-trend` | 🔒 | Dashboard | Points for the sales trend graph |
| 8 | GET | `/api/invoices` | 🔒 | Invoices | Paginated invoice ledger |
| 9 | GET | `/api/invoices/:id` | 🔒 | Invoices | Full invoice detail |
| 10 | GET | `/api/invoices/:id/print` | 🔒 | Invoices | Printable receipt data |
| 11 | DELETE | `/api/invoices/:id` | 🔒 | Invoices | Hard delete + revert tag statuses |
| 12 | POST | `/api/invoices` | 🔒 | Billing | Atomic create invoice |
| 13 | POST | `/api/invoices/:id/payments` | 🔒 | Billing | Append payment record |
| 14 | GET | `/api/customers` | 🔒 | Customers | Phone-number lookup during billing |
| 15 | POST | `/api/tags` | 🔒 | Tagging | Create tag with nanoid code |
| 16 | GET | `/api/tags/:code/label` | 🔒 | Tagging | Label print payload |
| 17 | GET | `/api/tags/:code` | 🔒 | Tagging | Scan lookup (409 if sold) |

Not in this table but already implemented: `GET /api/health` — infra-only DB connectivity check, see `src/app/api/health/route.ts`.

---

## Tech Stack

| Tool | Role | Status |
|---|---|---|
| Next.js 16 (App Router) | Runtime + routing + the HTTP layer itself | ✅ installed |
| TypeScript | Type safety | ✅ installed |
| Mongoose 9.x | MongoDB ODM | ✅ installed, connection helper ready (`src/lib/db/mongoose.ts`) |
| Zod 4.x | Input validation, shared with client forms | ✅ installed, no schemas written yet |
| bcryptjs | Password hashing (pure JS — no native build step, serverless-friendly) | ✅ installed |
| jsonwebtoken | JWT generation (`signToken`) & verification (`verifyToken`) | ✅ installed, `src/server/auth/jwt.ts` |
| `request.headers.get("authorization")` | Reading the bearer token — no cookie, so no `cookies()`/`cookie-parser` needed for auth | built into the Fetch API `Request` object |
| Pino + pino-pretty | Structured logging | ✅ installed, instance ready (`src/lib/logger.ts`) |
| nanoid | Cryptographically secure tag codes (`TAG-XXXXXXXX`) | ✅ installed |

**Not installed, and not needed:** `express`, `cors`, `cookie-parser`, `helmet`, `express-rate-limit`. Same-origin requests have no CORS problem; the session token is read from a plain header, not a cookie; a reverse proxy or `next.config.ts` `headers()` covers security headers if ever needed.

---

## Environment Variables (`.env`)

Already created (`.env` for local dev, `.env.example` for the template), validated at import time by `src/lib/env.ts` (throws on boot if anything required is missing — fail fast instead of a silent `undefined` landing in a Mongoose call):

```env
MONGODB_URI=mongodb://localhost:27017/jewellery_crm
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=7d
SETUP_SECRET=replace-with-a-long-random-string
NODE_ENV=development
```

Import `env` from `@/lib/env` anywhere a server-only variable is needed — never read `process.env.X` directly in new code, so a typo or missing var fails loudly at startup instead of at the first request that happens to hit that code path.

There is no `PORT` variable — `next dev` / `next start` default to `3000`; pass `-p <port>` if a different port is ever needed. There is no `CORS_ORIGIN` or `FRONTEND_URL` — nothing to allow-list, it's one origin.

---

## Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── health/route.ts                     ✅ done — DB connectivity check
│   │   ├── auth/
│   │   │   ├── register/route.ts                not started
│   │   │   ├── login/route.ts                   not started
│   │   │   ├── logout/route.ts                  not started
│   │   │   ├── forgot-password/route.ts         not started
│   │   │   └── reset-password/route.ts          not started
│   │   ├── dashboard/
│   │   │   ├── summary/route.ts                 not started
│   │   │   └── sales-trend/route.ts             not started
│   │   ├── customers/route.ts                   not started
│   │   ├── tags/
│   │   │   ├── route.ts                         not started       (POST)
│   │   │   └── [code]/
│   │   │       ├── route.ts                     not started       (GET scan lookup)
│   │   │       └── label/route.ts               not started       (GET label payload)
│   │   └── invoices/
│   │       ├── route.ts                         not started       (GET list, POST create)
│   │       └── [id]/
│   │           ├── route.ts                     not started       (GET detail, DELETE)
│   │           ├── print/route.ts               not started
│   │           └── payments/route.ts            not started       (POST)
│   ├── (auth)/...                               not started — see docs/frontend_setup.md
│   └── (app)/...                                not started — see docs/frontend_setup.md
│
├── models/                                      not started — one Mongoose model file per collection, created alongside the first route that needs it
│   ├── User.model.ts
│   ├── PasswordResetToken.model.ts
│   ├── Customer.model.ts
│   ├── Tag.model.ts
│   ├── Invoice.model.ts
│   └── InvoiceCounter.model.ts
│
├── schemas/                                     not started — Zod schemas, one file per module, imported by both route handlers and client forms
│   ├── auth.schema.ts
│   ├── customer.schema.ts
│   ├── tag.schema.ts
│   └── invoice.schema.ts
│
├── server/
│   ├── auth/
│   │   ├── jwt.ts                                ✅ done — signToken(), verifyToken()
│   │   ├── password.ts                           ✅ done — bcrypt hash/compare wrappers
│   │   └── session.ts                             not started — requireAuth(request): reads the `Authorization: Bearer <token>` header, calls verifyToken(), returns null on success or a 401 Response on failure
│   └── services/                                 one file per module — business logic the route handler calls, keeps route.ts files thin
│       ├── authService.ts                        ✅ done — registerUser(), loginUser()
│       ├── dashboardService.ts
│       ├── customersService.ts
│       ├── tagsService.ts
│       └── invoicesService.ts
│
└── lib/                                          ✅ generic infra
    ├── env.ts                                     zod-validated process.env
    ├── db/mongoose.ts                              cached Mongoose connection
    ├── logger.ts                                   pino instance
    ├── utils.ts                                    cn() class merge helper (frontend-facing, listed here for completeness)
    ├── auth-token.ts                                frontend-facing — get/set/clearStoredToken() over sessionStorage, see docs/frontend_setup.md
    └── api-client.ts                                frontend-facing browser fetch wrapper, attaches the Authorization header, see docs/frontend_setup.md
```

---

## MongoDB Collections

See `docs/DATABASE_DESIGN.md` for the full Mongoose schema definitions (unchanged — copy them into `src/models/*.model.ts` verbatim when each module is built).

---

## Route Handler Pattern

Every Route Handler follows this shape. Example for a 🔒 GET endpoint with a dynamic segment:

```typescript
// src/app/api/tags/[code]/route.ts
import { dbConnect } from "@/lib/db/mongoose";
import { requireAuth } from "@/server/auth/session";
import { TagModel } from "@/models/Tag.model";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError; // a pre-built 401 Response

  await dbConnect();
  const { code } = await params;

  const tag = await TagModel.findOne({ code: code.toUpperCase() });
  if (!tag) {
    return Response.json({ error: "No tag with this code" }, { status: 404 });
  }
  if (tag.status === "sold") {
    return Response.json({ error: "This tag is already sold" }, { status: 409 });
  }

  return Response.json(tag);
}
```

Key points baked into this pattern:
- `requireAuth()` is called first, inside the handler. There's no `proxy.ts` layer backing it up here — the token lives in `sessionStorage`, which the server never sees on anything but an explicit `fetch` call, so this check is the *only* enforcement point (see §6).
- `dbConnect()` is called every time — it's a no-op after the first call per process thanks to the cache in `src/lib/db/mongoose.ts`.
- `params` is awaited, never destructured directly from the second argument.
- Validation errors use Zod's `safeParse`, not `parse` + try/catch, so the 422 shape is explicit:
  ```typescript
  const parsed = createTagSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 422 },
    );
  }
  ```
  (`z.flattenError` is the Zod v4 name — v3 code examples online use `error.flatten()`, which still exists in v4 but flattenError is the documented replacement; verify against `node_modules/zod/...` types if unsure.)

---

## Business Rules (Invariants)

1. **Double-Sale Prevention:** Tag lookup returns `409` when `status === 'sold'`. Invoice creation also validates all tags before committing.
2. **Atomic Invoice Numbers:** Sequential collision-free via MongoDB `$inc` on `invoice_counters` collection.
3. **Cascade Rollback on Delete:** `DELETE /api/invoices/:id` finds all `tagCode` values in `items[]` and bulk-updates those tags back to `status: 'tagged'`.
4. **No Negative Pending:** Payment validation ensures `paidAmount` never exceeds `grandTotal`.
5. **Client-Side Math Authority:** Backend stores totals as provided by client and validates structure (Zod) but does not recalculate.
6. **Customer Upsert on Billing:** Customer is created or updated by phone number atomically during invoice creation — no separate "create customer" endpoint needed.

---

## §6. Auth: `requireAuth()` — the only server-side check there is

**Decision (overriding the original cookie-based design):** the JWT is returned in the login response body and stored client-side in `sessionStorage` (`src/lib/auth-token.ts`), not in a cookie. This was an explicit choice by the project owner, with a real trade-off worth keeping in mind: an httpOnly cookie can't be read by JavaScript at all, so it's immune to a token being stolen via XSS; a `sessionStorage` token can be read by any script running on the page, so it's only as safe as the app's XSS surface. There is currently no CSP or other XSS hardening in this project beyond "don't introduce injectable HTML."

**Consequence for `proxy.ts`:** a cookie is sent automatically on every request, including a plain page navigation, so a server-side `proxy.ts` could inspect it before the page even rendered. `sessionStorage` is **only visible to client-side JavaScript** — the server gets nothing on navigation, only on an explicit `fetch`/`apiClient` call that attaches the header. So `proxy.ts` **cannot** do the originally-planned "redirect to `/login` if no session" check anymore; there is nothing in the request for it to look at. Don't build that version of `proxy.ts`. If protected pages need a pre-render redirect later, it would have to come from somewhere else (e.g. a short-lived auxiliary cookie set alongside the token, or accepting a client-side-only redirect flash) — not decided yet, revisit when the first protected page is actually built.

**What this leaves as the real (and only) security boundary:**

**`src/server/auth/session.ts` → `requireAuth(request)`** (not built yet) — called at the top of every 🔒 route handler:
```typescript
import { verifyToken } from "@/server/auth/jwt";

export async function requireAuth(request: Request): Promise<Response | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return Response.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  return null; // caller can also want the payload (userId) - consider returning it alongside, see note below
}
```
Returns `null` on success or a pre-built `401 Response` on failure, matching the pattern already shown in the Route Handler Pattern section above. Note: as written this throws away `payload.userId`; by the time a route actually needs "who is the logged-in user" (not yet, since there's only one user total), change the return type to carry the payload through instead of just `null`/`Response`.

---

## Development Scripts

```bash
pnpm dev         # next dev — serves both pages and /api/* on http://localhost:3000
pnpm build       # next build — type-checks + builds
pnpm start       # next start — run the production build
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
```

No `pnpm test` — no testing libraries are installed by design.
