# Progress & Handoff Notes

**Read this first.** This file is the current-state snapshot for whoever (human or AI) picks this project up next. The other three docs (`REQUIREMENTS.md`, `DATABASE_DESIGN.md`, `bckend_setup.md`, `frontend_setup.md`) are the stable specs; this file is the "what's actually done so far" tracker — update it as each endpoint ships.

---

## How this repo came to exist

There is a sibling project at `../jewellery-crm/` (a pnpm monorepo: React/Vite frontend in `apps/web`, Express/Mongoose backend in `apps/api`). That repo's own `docs/` described a tags/invoices/billing/dashboard/POS system, but its actual source code implemented a *different*, unrelated set of modules (customers/inventory/orders/metal-rates) — the two had drifted apart. Nothing there was committed to git.

Decision made with the project owner: **start a brand-new Next.js project here, do not touch the old repo.** This repo has no shared git history, dependencies, or source with `jewellery-crm/`.

## Decisions made this session

1. **Single Next.js app, no monorepo.** Next.js Route Handlers replace the Express API; pages replace the Vite SPA. One `package.json`, one `pnpm dev`, one deploy. No turborepo, no `packages/shared` — there's no package boundary left to share across, so Zod schemas just live in `src/schemas/` and get imported by both a route handler and a client form directly.
2. **MongoDB + Mongoose stays**, as already decided in the original docs.
3. **No testing libraries** — explicit project requirement, carried over.
4. **axios → native `fetch`** (`src/lib/api-client.ts`). Same-origin now, so there's no CORS problem an axios interceptor was solving.
5. **Cache Components disabled** in `next.config.ts` (the `cacheComponents: true` / `partialPrefetching: true` that `create-next-app` enables by default). This is Next.js 16's new static-by-default rendering model; it requires `<Suspense>` around any dynamic/cookie/DB read. Every page in this app is dynamic (dashboard totals, invoice ledgers, session-gated routes), so that model adds ceremony with no payoff here. Disabling it reverts to the classic "pages and Route Handlers are dynamic unless you opt into caching" model, which matches the Express-era mental model this project is migrating from. **If this is ever re-enabled, re-read `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` first** — the rules for what can and can't be prerendered are genuinely different from pre-v16 Next.js.
6. **`middleware.ts` → `proxy.ts`.** Next.js 16 renamed the file/export. **Superseded by decision #8 below** — not building the auth-redirect version of this at all.
7. Zod v4 is installed (not v3, which the very first drafts of these docs assumed). Mostly compatible for basic schemas; check `zod.dev/v4` before using anything beyond `.object()/.string()/.number()`.
8. **Session token in `sessionStorage` + `Authorization` header, not an httpOnly cookie.** This reverses the original REQUIREMENTS.md design (`JWT in an httpOnly, Secure, SameSite=Strict cookie`) — the project owner explicitly asked for the cookie to be removed and the token handed to the frontend to store itself. Implemented after `POST /api/auth/login` already had the cookie version working; it was reverted to return `{ user, token }` in the body instead.
   - **Trade-off, flagged but overridden by explicit instruction:** an httpOnly cookie can't be read by any JavaScript, so it's immune to token theft via XSS. A `sessionStorage` token *can* be read by any script on the page — it's only as safe as the app's XSS surface, and this project has no CSP or other XSS hardening beyond normal React escaping.
   - **Real architectural consequence:** a cookie travels automatically on every request, so a server-side `proxy.ts` could inspect it before a protected page even rendered. `sessionStorage` is invisible to the server on a plain navigation — only an explicit `fetch` (via `src/lib/api-client.ts`) carries the token, as an `Authorization: Bearer <token>` header. So the "redirect unauthenticated requests to /login in `proxy.ts`" plan from decision #6 is **dead** — there's nothing there for the server to check. Protected pages (`(app)/layout.tsx`, not built yet) will need a client-side auth gate instead (check `sessionStorage` after mount, redirect if empty) — not designed in detail yet, see `frontend_setup.md`'s directory structure section.
   - Added `src/lib/auth-token.ts` (`getStoredToken`/`setStoredToken`/`clearStoredToken`, SSR-safe) and updated `src/lib/api-client.ts` to attach the header and to clear the token on a `401`.
   - `requireAuth()` (not built yet, see checklist) will read `request.headers.get("authorization")` instead of a cookie — already reflected in `bckend_setup.md §6`'s planned implementation.
9. **Open question, not yet decided — flagging before `POST /api/invoices` gets built:** per `DATABASE_DESIGN.md §3` / `REQUIREMENTS.md` endpoint #12, invoice creation "upserts" the `customers` collection by phone using whatever is in the invoice's embedded `customer: {...}` body at submission time. `GET /api/customers?phone=` (built this session) is read-only and only pre-fills the POS form — it's the invoice `POST` that actually writes. Consequence: if a cashier edits an autofilled name/email/address before finalizing a sale (typo or otherwise), that overwrites the customer's master record for every future lookup, with no diff/confirm step and no history. The invoice's own `customer: {...}` snapshot (`DATABASE_DESIGN.md §2.5`) stays correct regardless either way, since it's denormalized onto the invoice itself. **Decide before implementing:** overwrite-on-every-invoice (current spec, simplest), or only touch the master record's fields when they actually differ, or don't upsert name/email/address at all after first creation (phone-only match, immutable profile). No default has been chosen yet.

## What's built (passes `pnpm typecheck`, `pnpm lint`, `pnpm build`; manually smoke-tested)

- `create-next-app` scaffold: TypeScript, Tailwind v4, ESLint, App Router, `src/` dir, `@/*` import alias.
- All runtime deps installed (see `package.json`) — mongoose, zod, bcryptjs, jsonwebtoken, nanoid, @tanstack/react-query, zustand, react-hook-form, @hookform/resolvers, date-fns, sonner, jsbarcode, qrcode.react, recharts, clsx, tailwind-merge, lucide-react, pino(+pretty).
- `src/lib/env.ts` — zod-validated `process.env`, throws on missing/invalid vars at import time.
- `src/lib/db/mongoose.ts` — cached Mongoose connection (`dbConnect()`), safe across Next dev hot-reloads.
- `src/lib/logger.ts` — pino instance (pretty-printed in dev).
- `src/lib/utils.ts` — `cn()`.
- `src/lib/api-client.ts` — fetch wrapper for client components, `ApiError` class, attaches `Authorization: Bearer <token>` from `src/lib/auth-token.ts`, 401 → clears the stored token and redirects to `/login`.
- `src/lib/auth-token.ts` — `getStoredToken()`/`setStoredToken()`/`clearStoredToken()` over `sessionStorage` (SSR-safe guards).
- `src/app/api/health/route.ts` — `GET /api/health`, confirmed working against a local MongoDB (`{"status":"ok","db":"connected"}`).
- `src/models/User.model.ts` — Mongoose model matching `DATABASE_DESIGN.md §2.1`.
- `src/schemas/auth.schema.ts` — `registerSchema` (Zod v4).
- `src/server/auth/password.ts` — `hashPassword()`/`comparePassword()` (bcryptjs, 10 salt rounds).
- `src/server/auth/jwt.ts` — `signToken()`, `verifyToken()`. (A `getTokenMaxAgeSeconds()` helper existed briefly for the cookie's `maxAge` and was removed as dead code once the cookie was dropped — see decision #8.)
- `src/server/auth/session.ts` — `requireAuth(request)`: reads the `Authorization: Bearer <token>` header, calls `verifyToken()`, returns `null` on success or a pre-built `401` `Response` on failure (no/malformed header → `{"error":"Unauthorized"}`, invalid/expired token → `{"error":"Invalid or expired session"}`). Now called from every tags route (the first 🔒 business module, see below) — it's the only server-side enforcement point this app has (see `bckend_setup.md §6`).
- `src/server/services/authService.ts` — `registerUser()`, `loginUser()`, `UserAlreadyExistsError`, `InvalidCredentialsError` (same message/error for "no such user" and "wrong password", by design — prevents email enumeration).
- `src/app/api/auth/register/route.ts` — `POST /api/auth/register`, manually verified all 4 cases (403 no/wrong secret, 422 bad body, 201 create, 409 on repeat) against a local MongoDB; confirmed the stored `passwordHash` is an actual bcrypt hash, not plaintext.
- `src/app/api/auth/login/route.ts` — `POST /api/auth/login`, manually verified: 422 on bad body, 401 (identical message) for both unknown email and wrong password, 200 with `{ user, token }` in the body and **no `Set-Cookie` header at all** (see decision #8) on success. Decoded the issued JWT — `{ userId }` matches the real user's `_id`, expiry is exactly 7 days out. Test user deleted after each session.
- **Tagging module (first 🔒 business module) — backend and frontend both done:**
  - `src/models/Tag.model.ts` — matches `DATABASE_DESIGN.md §2.4`.
  - `src/schemas/tag.schema.ts` — `createTagSchema` (snake_case request body).
  - `src/server/services/tagsService.ts` — `createTag()` (collision-checked `TAG-XXXXXXXX` via `nanoid`, 5 retry attempts), `findTagByCode()`, `listTags()` (pagination + regex search on `productName`/`code`, user input escaped before building the `RegExp` + status filter), `serializeTag()`.
  - `src/app/api/tags/route.ts` — `POST` (create) and `GET` (list — **not in the original `REQUIREMENTS.md` spec**, added for the reprint-from-table UI; `page`/`limit`/`q`/`status` query params, `{data, total, page}` response, same envelope shape as the documented invoices list endpoint).
  - `src/app/api/tags/[code]/route.ts` — `GET` scan lookup, 404/409 per the double-sale-prevention rule. All manually verified against a local MongoDB with short-lived signed JWTs (no real user credentials needed); test tags deleted after each verification pass.
  - `src/app/api/tags/[code]/label/route.ts` — `GET` label/print payload, deliberately no sold-status check (reprinting a sold item's label is a legitimate audit use, and `REQUIREMENTS.md` only lists 404/409 as errors for the scan-lookup endpoint, not this one).
  - Frontend: `src/features/tagging/{hooks,components}` — `useCreateTag()` (invalidates the tags list cache on success), `useTags()` (paginated/searchable list query), `TagForm.tsx` (net weight auto-computed from gross − stone, still editable), `Barcode.tsx` (`jsbarcode` CODE128, confirmed scannable with a real phone), `TagLabelPreview.tsx` (print button, uses the `tag-bw*` print-safe classes from `globals.css`), `TagsTable.tsx` (search/status filter/pagination/reprint — not in the original plan).
  - Also added `print:hidden` to `Sidebar.tsx`/`Header.tsx` so printing a label only prints the label, not the app shell — reusable for invoice printing later.
  - **Not yet done:** exact `@page` mm sizing for real thermal label printers (current output is print-safe, not millimeter-calibrated); the `409` already-sold path on the scan-lookup endpoint is implemented but unexercised against live data since nothing sets `status: 'sold'` until Invoices exists.
- **Daily metal rates + purity catalog (new feature, not in the original spec) — backend and frontend both done.** Full design rationale (including two rejected earlier designs) in `docs/metal-rates-plan.md`.
  - `src/models/MetalPurity.model.ts` — one collection doing double duty as both the purity catalog and its current rate: `{ metal, purity, ratePerGram: number | null, active }`, unique `{metal, purity}` index. `ratePerGram` starts `null` ("exists, not priced yet"); `active: false` is how a purity is removed (archived, not hard-deleted) so existing tags/rates referencing it never break.
  - `src/models/Tag.model.ts` — **changed**: `metal`/`purity` string fields replaced with `purityId` (a real reference to `MetalPurity`), so renaming a purity updates every tag that uses it automatically instead of leaving stale copies behind. `serializeTag()` populates it and flattens back to the same `metal`/`purity` strings the API already returned, so nothing downstream had to change shape.
  - `src/server/services/metalPuritiesService.ts` — `addPurity()` (409 on an active duplicate; re-activates instead of erroring if a matching *archived* one exists; race-condition-safe duplicate-key handling, same pattern as `authService.ts`'s `registerUser()`), `renamePurity()`, `setPurityActive()` (archive/un-archive), `deletePurity()` (409 if any tag still references it, via `Tag.countDocuments({purityId})` — true hard delete only when unused), `setRate()` (update-only, never upsert — 404 if the purity was never added, so a rate can't be set for something that skipped the Add Purity step).
  - Routes: `src/app/api/purities/route.ts` (`GET` list, `?metal=`/`?includeInactive=` filters; `POST` add), `src/app/api/purities/[id]/route.ts` (`PATCH` rename and/or archive, `DELETE`), `src/app/api/metal-rates/route.ts` (`PUT` set rate).
  - Frontend: `src/app/(app)/settings/page.tsx` — two tabs, "Set Metal Rate" (`MetalRateForm.tsx` + `MetalRatesTable.tsx`, grouped side-by-side by metal, only showing priced purities, "Edit" reloads a row into the form, form clears itself after a successful save) and "Add Purity" (`AddPurityForm.tsx` + `PurityList.tsx` — inline rename, archive/unarchive, delete). `src/features/tagging/components/TagForm.tsx` updated to pick a purity (not type metal/purity strings) from this same catalog, filtered by metal. `Settings` moved from the sidebar's disabled "Coming soon" list to a real nav entry.
  - **Bugs found (via a full code review) and fixed:** `GET /api/tags/:code` and `.../label` had no `try/catch` around serialization, so a tag with an unresolvable purity reference crashed the request instead of returning a clean error (now fixed, matching the list route); `TagForm.tsx`'s purity selection was silently discarded on any background refetch of the purities list instead of only when it actually became invalid; `addPurity()`'s check-then-act had the same duplicate-key race `registerUser()` already had to handle. Also extracted the repeated Zod-422-response boilerplate (6+ call sites, including the original auth routes) into `src/server/validation.ts`.
  - Separately: 4 leftover dev/test tags from before this migration (no `purityId`) were deleted from MongoDB — they predated this change and had no real inventory value.
- **Customers module (read-only lookup, no create endpoint by design — see decision in `bckend_setup.md §6`: creation/upsert only happens inside invoice creation, not built yet):**
  - `src/models/Customer.model.ts` — matches `DATABASE_DESIGN.md §2.3` (`name`, unique indexed `phone`, optional `email`/`address`).
  - `src/schemas/customer.schema.ts` — `customerPhoneQuerySchema` (validates the `?phone=` query param).
  - `src/server/services/customersService.ts` — `findCustomerByPhone()`, `serializeCustomer()` (returns `{id, name, email, address}` — no `phone` in the response, matching the documented contract since the caller already has it).
  - `src/app/api/customers/route.ts` — `GET /api/customers?phone=`, 🔒. Manually verified against a local MongoDB: 422 (missing phone), 401 (missing/invalid token), 404 (unknown phone), 200 (known phone, exact field match to `REQUIREMENTS.md` endpoint #11). Test customer deleted after verification.
- `src/app/layout.tsx` / `src/app/providers.tsx` — root layout wired to `QueryClientProvider` + `<Toaster />`.
- `src/app/page.tsx` — temporary landing page that calls `/api/health` and shows DB status. **Not a real product page** — replace once there's something real to land on (dashboard or /login redirect).
- `.env` (local, gitignored) + `.env.example` with `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SETUP_SECRET`, `NODE_ENV`.
- `next.config.ts` — Cache Components disabled (see decision #5); Turbopack CSS loader rule kept (required for Tailwind v4's `@theme` at-rule to parse — removing it silently breaks all styling with only a build warning, not an error, so don't remove it without re-testing output CSS size).

A local MongoDB is running on `localhost:27017` as of this session (confirmed via `nc -z localhost 27017` and the health check) — if it's not running next time, `brew services start mongodb-community` or start the `mongod` binary found at `/opt/homebrew/bin/mongod`.

**Feature-wise folder structure pre-created** (empty except for a `.gitkeep` until a real file lands — delete the `.gitkeep` at that point, already done for `models/`, `schemas/`, `server/auth/`, `server/services/`):
- Frontend: `src/features/{auth,tagging}/{hooks,components}` now have real files (see "What's built" above); `features/{dashboard,billing}`, `billing/lib` (`calculations.ts`), `store/`, `components/{ui,layout}` have since been partly filled in too by the login/app-shell and tagging work — this note is stale as a whole, kept for history
- Backend: `src/models/` (has `User.model.ts`), `src/schemas/` (has `auth.schema.ts`), `src/server/auth/` (has `password.ts`, `jwt.ts`), `src/server/services/` (has `authService.ts`)

No `app/(auth)|(app)/**` page folders exist yet — those get created together with the actual page, not pre-scaffolded, since an empty `page.tsx` with no export breaks the Next.js build. `app/api/auth/{register,login}/` are the first real route folders.

## What's NOT built yet

`requireAuth()`/`session.ts`, logout, forgot/reset-password, `proxy.ts`, every business module (tags/customers/invoices/dashboard), and every page. This was a deliberate scope decision — see `bckend_setup.md §0` and `frontend_setup.md §3` for the planned directory structure and endpoint list.

### Suggested build order (one endpoint/module at a time, per the project owner's stated plan)

Auth has to come first since almost everything else is 🔒:

- [x] `src/server/auth/password.ts` (bcrypt wrappers)
- [x] `src/server/auth/jwt.ts` (sign/verify/maxAge)
- [x] `src/server/auth/session.ts` (`requireAuth()` — needed before any 🔒 route can be built)
- [x] `src/models/User.model.ts`
- [x] `POST /api/auth/register` (🔑 setup-secret gated)
- [x] `POST /api/auth/login` (returns `{ user, token }`, no cookie — see decision #8)
- [x] `src/models/Tag.model.ts` → `POST /api/tags`, `GET /api/tags/:code`, `GET /api/tags/:code/label`, plus `GET /api/tags` (list — added beyond the original spec for the reprint UI; see "What's built" below)
- [x] `src/models/MetalPurity.model.ts` → `GET`/`POST /api/purities`, `PATCH`/`DELETE /api/purities/:id`, `PUT /api/metal-rates` (new feature, not in the original spec — see "What's built" below and `docs/metal-rates-plan.md`)
- [x] `src/models/Customer.model.ts` → `GET /api/customers`
- **Invoices/Billing module — backend and frontend both done (Phases 0–10 of `docs/billing-plan.md`, plus an extensive second round of real-usage bug fixes — see that file for full detail, this is a summary).**
  - Backend: `src/models/Invoice.model.ts`/`InvoiceCounter.model.ts`, `src/schemas/invoice.schema.ts` (`createInvoiceSchema`, `addInvoicePaymentSchema`), `src/server/services/invoicesService.ts` (full transaction via `session.withTransaction()` — a real bug was found and fixed here: manual `startTransaction()`/`commitTransaction()` failed on the very first write to a brand-new collection), all 6 invoice routes. Required a one-time local infra fix (MongoDB converted to a single-node replica set, `rs0`) since transactions silently don't work on a standalone instance.
  - Frontend: `src/features/billing/lib/calculations.ts`, `src/store/useBillingStore.ts`, 7 hooks, 8 components (`CustomerFields`, `ScanInput`, `TagBrowseDialog`, `ItemTable`, `TotalsPanel`, `PaymentPanel`, `NumberField`, `Dialog` — the app's first modal primitive), 4 pages (`/billing`, `/invoices`, `/invoices/[id]`, `/invoices/[id]/print`, plus a new `/invoices/[id]/payments/[index]/receipt` for per-payment receipts).
  - `DELETE /api/invoices/:id` is built but deliberately **not** linked from any UI (decision 5).
  - **Real bugs found via the user's own manual testing and fixed**, beyond what review/typecheck caught: a leading-zero display bug on every numeric input (`<input type="number">`'s React DOM-sync quirk), rate-per-gram/gross/net weight not actually being enforced as mandatory end-to-end, a `GET /api/purities` response-shape mismatch breaking "Browse Tags," net-weight rounding losing a digit (2dp instead of 3dp — fixed in both the billing page and the Tagging module's `TagForm.tsx`), and the item grid never being able to accept a typed decimal or recompute Net Wt from Gross/Stone (two separate, now-fixed gaps, not regressions of each other — see `billing-plan.md` for exactly what was checked before concluding that).
  - **A full manual browser walkthrough has now been done** (Chrome extension finally connected): customer lookup/autofill, Add Item modal (decimals, no bg-dim), Browse Tags (the exact flow the `purities.find` bug broke — confirmed fixed), duplicate-tag rejection, live grid editing (decimal typing + Net Wt auto-recompute, confirmed by hand), Finalize Sale, the invoices ledger, Collect Payment + "Pay remaining", and the Tagging module staying unaffected. **Zero console errors the entire time.** Full detail in `docs/billing-plan.md` Phase 11. One real new finding from this pass: duplicate customer records exist in the live database for the same person under two phone formats (`7379972427` vs `07379972427`, a leading-zero variant) — the exact-10-digit lookup can never find a customer whose number was ever typed with an extra digit, silently creating a second profile. **Deferred — will fix later, not addressed yet.**
  - **Still-open gaps:**
    - A concurrency sanity check for `POST /api/invoices` (two simultaneous requests racing for the same tag) — needs true concurrency, not sequential curl calls.
    - The invoice detail page's item table still shows less than the print page (no HSN, gross/stone weight, or charges) — flagged to the user once, no answer yet on whether to bring it to parity.
    - The print/receipt pages' actual rendered layout couldn't be screenshotted — `window.print()` opens a native dialog that blocks the automation tooling entirely (confirmed twice); both pages resolve to the correct URL and data without erroring, but the visual layout itself still needs a manual look.
    - The customer-phone-duplication finding above — **deferred, will fix later.**
  - **Full implementation plan, phased, with every decision's rationale, in `docs/billing-plan.md`** — same role as `docs/metal-rates-plan.md` played for the purity/rates feature.
- [ ] `GET /api/dashboard/summary`, `GET /api/dashboard/sales-trend` — still not built. Next logical piece now that invoices exist to aggregate over.
- [x] Pages: `(auth)/login`, `(app)/layout` (AppShell + client-side session redirect), `(app)/dashboard` (KPI tiles/chart still pending the dashboard endpoints above), `(app)/billing`, `(app)/invoices` — all exist now; dashboard's own data-fetching hooks/components are the remaining piece, tracked above.
- [x] Page: `(app)/tagging` — create form, label preview/print, searchable/paginated tags table with reprint
- [x] Page: `(app)/settings` — Set Metal Rate + Add Purity tabs (see "What's built" below)
- [x] `src/app/page.tsx` swapped from its placeholder to a real client-side redirect (`/dashboard` or `/login` based on `sessionStorage`)

**Deprioritized — low value right now, moved to the end on purpose:**
- [ ] `src/models/PasswordResetToken.model.ts`
- [ ] `POST /api/auth/logout` (now just an acknowledge-only endpoint — the real logout is the frontend calling `clearStoredToken()`)
- [ ] `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (needs email-sending infra that doesn't exist yet in this project)
- [ ] ~~`proxy.ts` auth redirect~~ — not happening, see decision #8. If `proxy.ts` is ever added for something else (not auth), that's a separate, unplanned task.

**Next up:** `GET /api/dashboard/summary` + `GET /api/dashboard/sales-trend` (aggregations over `invoices`, now that the Billing module exists to aggregate over) and the `/dashboard` page's actual KPI tiles/chart to consume them. Before that, though, see `docs/billing-plan.md`'s remaining open items: a concurrency sanity check on `POST /api/invoices`, and — most importantly — an actual manual browser walkthrough of the whole billing flow, which hasn't happened yet this session (no Chrome extension connection) despite everything else being built and fixed.

Update the checkboxes above as work lands, so this file stays an accurate "what's done" snapshot rather than going stale like the old repo's docs did.
