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
- `src/server/auth/session.ts` — `requireAuth(request)`: reads the `Authorization: Bearer <token>` header, calls `verifyToken()`, returns `null` on success or a pre-built `401` `Response` on failure (no/malformed header → `{"error":"Unauthorized"}`, invalid/expired token → `{"error":"Invalid or expired session"}`). Not called from any route yet — no 🔒 route exists until the first business module (tags) is built — but it's the only server-side enforcement point this app has (see `bckend_setup.md §6`), so it had to land before anything protected can.
- `src/server/services/authService.ts` — `registerUser()`, `loginUser()`, `UserAlreadyExistsError`, `InvalidCredentialsError` (same message/error for "no such user" and "wrong password", by design — prevents email enumeration).
- `src/app/api/auth/register/route.ts` — `POST /api/auth/register`, manually verified all 4 cases (403 no/wrong secret, 422 bad body, 201 create, 409 on repeat) against a local MongoDB; confirmed the stored `passwordHash` is an actual bcrypt hash, not plaintext.
- `src/app/api/auth/login/route.ts` — `POST /api/auth/login`, manually verified: 422 on bad body, 401 (identical message) for both unknown email and wrong password, 200 with `{ user, token }` in the body and **no `Set-Cookie` header at all** (see decision #8) on success. Decoded the issued JWT — `{ userId }` matches the real user's `_id`, expiry is exactly 7 days out. Test user deleted after each session.
- `src/app/layout.tsx` / `src/app/providers.tsx` — root layout wired to `QueryClientProvider` + `<Toaster />`.
- `src/app/page.tsx` — temporary landing page that calls `/api/health` and shows DB status. **Not a real product page** — replace once there's something real to land on (dashboard or /login redirect).
- `.env` (local, gitignored) + `.env.example` with `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SETUP_SECRET`, `NODE_ENV`.
- `next.config.ts` — Cache Components disabled (see decision #5); Turbopack CSS loader rule kept (required for Tailwind v4's `@theme` at-rule to parse — removing it silently breaks all styling with only a build warning, not an error, so don't remove it without re-testing output CSS size).

A local MongoDB is running on `localhost:27017` as of this session (confirmed via `nc -z localhost 27017` and the health check) — if it's not running next time, `brew services start mongodb-community` or start the `mongod` binary found at `/opt/homebrew/bin/mongod`.

**Feature-wise folder structure pre-created** (empty except for a `.gitkeep` until a real file lands — delete the `.gitkeep` at that point, already done for `models/`, `schemas/`, `server/auth/`, `server/services/`):
- Frontend: `src/features/{auth,dashboard,billing,tagging}/{hooks,components}` (+ `billing/lib` for `calculations.ts`) — still empty, `store/`, `components/{ui,layout}` — still empty
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
- [ ] `src/models/PasswordResetToken.model.ts`
- [x] `POST /api/auth/register` (🔑 setup-secret gated)
- [x] `POST /api/auth/login` (returns `{ user, token }`, no cookie — see decision #8)
- [ ] `POST /api/auth/logout` (now just an acknowledge-only endpoint — the real logout is the frontend calling `clearStoredToken()`)
- [ ] `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- [ ] ~~`proxy.ts` auth redirect~~ — not happening, see decision #8. If `proxy.ts` is ever added for something else (not auth), that's a separate, unplanned task.
- [ ] `src/models/Tag.model.ts` → `POST /api/tags`, `GET /api/tags/:code`, `GET /api/tags/:code/label`
- [ ] `src/models/Customer.model.ts` → `GET /api/customers`
- [ ] `src/models/Invoice.model.ts`, `src/models/InvoiceCounter.model.ts` → `POST /api/invoices` (the atomic, transactional one — build this carefully, see `DATABASE_DESIGN.md §3`), `GET /api/invoices`, `GET /api/invoices/:id`, `GET /api/invoices/:id/print`, `DELETE /api/invoices/:id`, `POST /api/invoices/:id/payments`
- [ ] `GET /api/dashboard/summary`, `GET /api/dashboard/sales-trend` (these are just aggregations over `invoices`, do them last)
- [ ] Pages: `(auth)/login`, `(app)/layout` (AppShell + **client-side** session redirect — no server-side check is possible, see decision #8), `(app)/dashboard`, `(app)/billing`, `(app)/tagging`, `(app)/invoices`
- [ ] Swap `src/app/page.tsx`'s placeholder for a real redirect once `/login` and `/dashboard` exist.

Update the checkboxes above as work lands, so this file stays an accurate "what's done" snapshot rather than going stale like the old repo's docs did.
