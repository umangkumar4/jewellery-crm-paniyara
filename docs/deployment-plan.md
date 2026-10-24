# Deployment — Vercel + MongoDB Atlas + Hostinger domain

> **Status: not deployed yet — this is the setup guide, worked out through discussion before touching any live infra.** Same reasoning as the other `*-plan.md` docs in this folder: hosting is a decision that's annoying to unwind once data lives on it, so it's recorded here first. Covers the full path from "code on this laptop" to "live on a real domain."

---

## Decisions made

1. **App host: Vercel, Hobby (free) tier.** Chosen over Railway (the initial recommendation) because the user explicitly wants to use Vercel free tier. **Known tradeoff, accepted knowingly, not a blind spot:** Vercel's Hobby plan Terms of Service restrict it to **non-commercial, personal use only** — this app runs a real shop's billing, so it is commercial use. Vercel doesn't actively scan for this, but at their sole discretion they could suspend a project found violating it, with no SLA/paid support to escalate to. See `#known-limitations-of-the-hobby-tier` below for the full list and sources. Nothing about the app technically requires Vercel — it's a plain Next.js app with no Vercel-only APIs in use, so migrating off later (to Pro, or elsewhere) is not a rewrite.
2. **Database: MongoDB Atlas, M0 (free) cluster**, not self-hosted. This directly fixes a real problem hit during local dev (`docs/billing-plan.md` point 1): invoice creation needs multi-document Mongoose **transactions**, which require a replica set, and the local standalone `mongod` could not run them until `rs.initiate()` was run manually. Atlas M0 is a genuine replica set out of the box, no config needed.
3. **Domain: bought at Hostinger, but only as registrar/DNS — the app is not hosted at Hostinger.** Hostinger's shared hosting is built for PHP/static sites, not a Next.js server with SSR + API routes. The domain just gets a DNS record pointed at Vercel.
4. **No static outbound IP for the database connection, on any Vercel tier.** Serverless functions don't get a fixed IP on Hobby *or* Pro without an enterprise add-on, so Atlas Network Access has to allow `0.0.0.0/0` either way — the app's own JWT auth is the real access boundary, not a DB-level IP allowlist. This isn't a reason to pick a different host.

---

## Known limitations of the Hobby tier

Pulled from Vercel's own docs (`vercel.com/docs/plans/hobby`, `vercel.com/docs/limits`, `vercel.com/terms`), not guessed:

| Limit | Value | Relevant to this app? |
|---|---|---|
| Commercial use | **Not permitted** ("restricted to non-commercial, personal use only") | Yes — accepted risk, see decision 1 |
| Function invocations | 1,000,000/mo | No — single-shop traffic won't get close |
| Function duration | 300s max | No — API routes are quick CRUD/Mongo calls |
| Bandwidth (Fast Data Transfer) | 100 GB/mo | No |
| Concurrent builds | 1 | No — solo dev, one push at a time |
| Deployments | 100/day, 100/hour | No |
| **Runtime log retention** | **1 hour** | **Yes — real gap.** `src/lib/logger.ts` (pino) writes straight to stdout with no other sink. Past 1 hour, any error log from a failed invoice/payment is gone with no way to see what broke. Optional mitigation (not yet implemented): add Sentry's free tier, or write critical-path failures into a Mongo collection alongside the app's own data. |
| Support/SLA | None | Compounds the log-retention gap — no escalation path if something breaks in production |

No contractual guarantee the free tier stays free/unchanged forever either — Vercel's Terms state Hobby is offered "at Vercel's sole discretion." Low practical risk for a single shop's internal tool, but not something to build irreversible assumptions on.

---

## Prerequisites confirmed in this repo

- `package.json` → `"packageManager": "pnpm@12.14.0"`, `pnpm-lock.yaml` present at repo root — Vercel auto-detects pnpm from this, no manual override needed.
- `npm run build` (`next build`) already verified clean locally — no build-time TypeScript/compile errors.
- Git remote already set: `origin → https://github.com/umangkumar4/jewellery-crm-paniyara.git`, branch `main`.
- Env vars required (from `.env.example` + `src/lib/env.ts`, which throws on startup if any are missing/invalid):

  | Variable | Required shape | Purpose |
  |---|---|---|
  | `MONGODB_URI` | non-empty string | Mongo connection string |
  | `JWT_SECRET` | **≥ 16 characters** | signs the login session JWT |
  | `JWT_EXPIRES_IN` | string, default `7d` | session length |
  | `SETUP_SECRET` | non-empty string | guards `POST /api/auth/register` (the one-time admin-creation endpoint) |
  | `NODE_ENV` | `development` \| `test` \| `production` | Vercel sets this to `production` automatically — don't set it manually in Vercel's env var UI |

  **Generate new values for `JWT_SECRET` and `SETUP_SECRET` for production — don't reuse whatever's in the local `.env`.** A quick way: `openssl rand -base64 32` for each.

---

## Step-by-step setup

### 1. Push the repo to GitHub

Vercel deploys from GitHub, so everything has to be committed and pushed first (`git push origin main`). Confirm `git status` is clean before importing into Vercel.

### 2. MongoDB Atlas (free M0 cluster)

1. Create an account at mongodb.com/cloud/atlas.
2. **Create a cluster → M0 (Free)**, any region close to India (e.g. Mumbai `ap-south-1`).
3. **Database Access** → add a database user (username + password — this becomes part of the connection string). Don't reuse this password anywhere else.
4. **Network Access** → **Add IP Address → Allow Access From Anywhere (`0.0.0.0/0`)**. Required because Vercel functions have no fixed outbound IP (see decision 4 above).
5. **Connect → Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/jewellery_crm?retryWrites=true&w=majority
   ```
   Make sure the database name (`/jewellery_crm`) is explicitly in the path — Atlas's copy button sometimes leaves it blank. This full string is the production `MONGODB_URI`.

### 3. Import the project into Vercel

1. vercel.com → **Add New… → Project** → import `jewellery-crm-paniyara` from GitHub.
2. **Framework Preset**: Vercel auto-detects **Next.js** from `package.json` — leave it as-is.
3. **Build & Output Settings** (Vercel fills these in automatically for the Next.js preset; only touch them if you need to override):
   - **Install Command**: `pnpm install` (auto, from the `packageManager` field + `pnpm-lock.yaml`)
   - **Build Command**: `pnpm run build` (runs the repo's own `"build": "next build"` script — no change needed)
   - **Output Directory**: left blank/auto — the Next.js framework preset manages this itself, there's no static output folder to point at
   - **Root Directory**: `./` (the app is at the repo root, not a monorepo subfolder)
4. **Environment Variables** — add all four before the first deploy (Project Settings → Environment Variables, or the import screen's env var section):
   - `MONGODB_URI` → the Atlas connection string from step 2.5
   - `JWT_SECRET` → a new random ≥16-char string
   - `JWT_EXPIRES_IN` → `7d`
   - `SETUP_SECRET` → a new random string, different from `JWT_SECRET`
   - Leave `NODE_ENV` unset — Vercel sets it to `production` for production deploys on its own.
   - Set these for the **Production** environment at minimum; add them to Preview too only if you intend to test preview deployments against the real database (optional — a Preview deploy without them will fail to start, since `src/lib/env.ts` throws on missing vars, which is a safe failure mode, not a bug to fix).
5. **Deploy.**

### 4. Create the production login user

The local dev Mongo already has `owner@shop.com`, but that's a different database — Atlas starts empty. Create the real admin account once, against the live deployment, via the setup-secret-guarded endpoint:

```bash
curl -X POST https://<your-vercel-url>/api/auth/register \
  -H "Content-Type: application/json" \
  -H "x-setup-secret: <the SETUP_SECRET you set in step 3.4>" \
  -d '{
    "name": "<owner name>",
    "email": "owner@shop.com",
    "password": "<a real password, at least 8 characters, not a throwaway>"
  }'
```

Field names (`name`, `email`, `password`) are exactly what `src/schemas/auth.schema.ts`'s `registerSchema` expects — a 422 response means a field is missing or doesn't meet its rule (email format, password ≥ 8 chars, name non-empty).

### 5. Connect the Hostinger domain

1. Vercel project → **Settings → Domains** → add the domain bought at Hostinger.
2. Vercel displays the exact DNS record to add — typically:
   - Apex domain (`example.com`): **A record** → `76.76.21.21`
   - Subdomain (`www.example.com`): **CNAME record** → `cname.vercel-dns.com`
3. In Hostinger: **hPanel → Domains → DNS / Nameservers → DNS Zone Editor** for that domain, add the exact record Vercel showed.
4. Propagation is usually minutes, sometimes a few hours. Vercel auto-issues the SSL certificate once DNS verifies — no manual certificate step.

---

## Post-deploy checklist

- [ ] `git push origin main` done, Vercel shows a successful deploy
- [ ] Atlas user created with a unique password, Network Access allows `0.0.0.0/0`
- [ ] All four env vars set in Vercel (`MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SETUP_SECRET`) — **not** `NODE_ENV`
- [ ] Production login user created via the `/api/auth/register` curl command, and logging in with it works end-to-end
- [ ] Hostinger DNS record added, domain resolves to the Vercel deployment with a valid HTTPS certificate
- [ ] Decide on the log-retention mitigation (Sentry, or a Mongo-backed error log) before relying on this for real sales — optional, not yet implemented
