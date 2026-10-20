# Jewellery CRM & POS

Article-level barcode tagging, fast POS barcode billing, customer lookup, partial payments, and daily sales analytics for a jewellery retail shop — built as a single Next.js (App Router) app with MongoDB/Mongoose.

**Start here:** `docs/PROGRESS.md` — current state, decisions made, and the endpoint-by-endpoint build checklist.

Full specs:
- `docs/REQUIREMENTS.md` — system overview, tech stack, API contract (17 endpoints), business rules
- `docs/DATABASE_DESIGN.md` — MongoDB collections, Mongoose schemas, transaction/rollback logic
- `docs/bckend_setup.md` — Route Handler conventions, auth pattern, Next.js 16-specific gotchas
- `docs/frontend_setup.md` — App Router page structure, client state, billing calculations, printing

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in real secrets before anything but local dev
pnpm dev                # http://localhost:3000 - serves pages and /api/* together
```

Requires a reachable MongoDB (`MONGODB_URI` in `.env`; defaults to `mongodb://localhost:27017/jewellery_crm`).

## Scripts

```bash
pnpm dev         # dev server
pnpm build       # type-checks + production build
pnpm start       # run the production build
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
```

No test runner is installed — no testing libraries, by project requirement.

## Stack

Next.js 16 · TypeScript · Tailwind CSS v4 · MongoDB + Mongoose · Zod · React Query · Zustand · React Hook Form · Pino

No Express, no separate API origin, no axios — Route Handlers under `src/app/api/**` are the backend; the browser talks to them same-origin via `src/lib/api-client.ts`.
