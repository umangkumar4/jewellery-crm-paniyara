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
6. **`middleware.ts` → `proxy.ts`.** Next.js 16 renamed the file/export; not created yet (depends on auth existing). See `bckend_setup.md §6` for the planned shape and the explicit warning that it's not a substitute for per-route auth checks.
7. Zod v4 is installed (not v3, which the very first drafts of these docs assumed). Mostly compatible for basic schemas; check `zod.dev/v4` before using anything beyond `.object()/.string()/.number()`.

## What's built (passes `pnpm typecheck`, `pnpm lint`, `pnpm build`; manually smoke-tested)

- `create-next-app` scaffold: TypeScript, Tailwind v4, ESLint, App Router, `src/` dir, `@/*` import alias.
- All runtime deps installed (see `package.json`) — mongoose, zod, bcryptjs, jsonwebtoken, nanoid, @tanstack/react-query, zustand, react-hook-form, @hookform/resolvers, date-fns, sonner, jsbarcode, qrcode.react, recharts, clsx, tailwind-merge, lucide-react, pino(+pretty).
- `src/lib/env.ts` — zod-validated `process.env`, throws on missing/invalid vars at import time.
- `src/lib/db/mongoose.ts` — cached Mongoose connection (`dbConnect()`), safe across Next dev hot-reloads.
- `src/lib/logger.ts` — pino instance (pretty-printed in dev).
- `src/lib/utils.ts` — `cn()`.
- `src/lib/api-client.ts` — fetch wrapper for client components, `ApiError` class, 401 → redirect to `/login`.
- `src/app/api/health/route.ts` — `GET /api/health`, confirmed working against a local MongoDB (`{"status":"ok","db":"connected"}`).
- `src/app/layout.tsx` / `src/app/providers.tsx` — root layout wired to `QueryClientProvider` + `<Toaster />`.
- `src/app/page.tsx` — temporary landing page that calls `/api/health` and shows DB status. **Not a real product page** — replace once there's something real to land on (dashboard or /login redirect).
- `.env` (local, gitignored) + `.env.example` with `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SETUP_SECRET`, `NODE_ENV`.
- `next.config.ts` — Cache Components disabled (see decision #5); Turbopack CSS loader rule kept (required for Tailwind v4's `@theme` at-rule to parse — removing it silently breaks all styling with only a build warning, not an error, so don't remove it without re-testing output CSS size).

A local MongoDB is running on `localhost:27017` as of this session (confirmed via `nc -z localhost 27017` and the health check) — if it's not running next time, `brew services start mongodb-community` or start the `mongod` binary found at `/opt/homebrew/bin/mongod`.

**Feature-wise folder structure pre-created** (empty, each holds only a `.gitkeep` placeholder — delete the `.gitkeep` the moment a real file lands in that folder):
- Frontend: `src/features/{auth,dashboard,billing,tagging}/{hooks,components}` (+ `billing/lib` for `calculations.ts`), `src/store/`, `src/components/{ui,layout}`
- Backend: `src/models/`, `src/schemas/`, `src/server/{auth,services}`

No `app/api/**` route folders or `app/(auth)|(app)/**` page folders exist yet — those get created together with the actual route handler / page, not pre-scaffolded, since an empty `route.ts`/`page.tsx` with no export breaks the Next.js build.

## What's NOT built yet (everything else)

No Mongoose models, no Zod schemas, no auth, no business routes, no feature pages, no `proxy.ts`. This was a deliberate scope decision — see `bckend_setup.md §0` and `frontend_setup.md §3` for the planned directory structure and endpoint list.

### Suggested build order (one endpoint/module at a time, per the project owner's stated plan)

Auth has to come first since almost everything else is 🔒:

- [ ] `src/server/auth/password.ts` (bcrypt wrappers), `src/server/auth/jwt.ts` (sign/verify), `src/server/auth/session.ts` (`requireAuth()`)
- [ ] `src/models/User.model.ts`, `src/models/PasswordResetToken.model.ts`
- [ ] `POST /api/auth/register` (🔑 setup-secret gated)
- [ ] `POST /api/auth/login` (sets the cookie)
- [ ] `POST /api/auth/logout`
- [ ] `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- [ ] `proxy.ts` (now that there's a `/login` to redirect to)
- [ ] `src/models/Tag.model.ts` → `POST /api/tags`, `GET /api/tags/:code`, `GET /api/tags/:code/label`
- [ ] `src/models/Customer.model.ts` → `GET /api/customers`
- [ ] `src/models/Invoice.model.ts`, `src/models/InvoiceCounter.model.ts` → `POST /api/invoices` (the atomic, transactional one — build this carefully, see `DATABASE_DESIGN.md §3`), `GET /api/invoices`, `GET /api/invoices/:id`, `GET /api/invoices/:id/print`, `DELETE /api/invoices/:id`, `POST /api/invoices/:id/payments`
- [ ] `GET /api/dashboard/summary`, `GET /api/dashboard/sales-trend` (these are just aggregations over `invoices`, do them last)
- [ ] Pages: `(auth)/login`, `(app)/layout` (AppShell + session redirect), `(app)/dashboard`, `(app)/billing`, `(app)/tagging`, `(app)/invoices`
- [ ] Swap `src/app/page.tsx`'s placeholder for a real redirect once `/login` and `/dashboard` exist.

Update the checkboxes above as work lands, so this file stays an accurate "what's done" snapshot rather than going stale like the old repo's docs did.
