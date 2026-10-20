# Daily Metal Rates + Purity Catalog — Implementation Plan

> **Status: planned, not yet built.** This is a new feature, not part of the original `REQUIREMENTS.md`/`DATABASE_DESIGN.md` spec — same situation as the tags list endpoint was. This doc exists so the design (worked out through discussion) is captured before implementation starts, the same way `frontend_setup.md`/`bckend_setup.md` capture the original spec's design.
>
> **This plan now also touches the already-shipped tagging feature, not just new files.** `Tag.model.ts` changes from storing `metal`/`purity` as plain strings to referencing a `MetalPurity` document by ID (see "Why this shape" #4). That's a real, deliberate scope expansion beyond "add a new rates feature" - flagged explicitly so it isn't a surprise mid-implementation.

## Why

The jeweller needs to record today's per-gram rate for each metal/purity combo they deal in, so billing can eventually prefill a scanned tag's line-item rate from it. A tag and its rate need to resolve to the exact same purity reliably - including staying correct if that purity is later renamed or retired - which is what drove the design below away from simple string-matching.

## Design (reached through discussion, see rationale below)

- **Metal** is a small fixed list (`Gold`, `Silver`, `Platinum`) — real physical metal types, not expected to change often. Lives in `src/lib/metals.ts`.
- **Purity and its rate live in one collection, one document per `{metal, purity}`** (`MetalPurity`). Adding a purity creates that document with `ratePerGram: null` ("exists, not priced yet"); setting a rate later fills it in, no history (every save overwrites in place).
- **Purity must be explicitly added via Settings before it can be used anywhere else** (rate-setting, tagging). Nothing creates a purity as a side effect of another action.
- **Setting a rate is an update, not an upsert.** `PUT /api/metal-rates` only updates an *existing* `{metal, purity}` document; `404` if that combo was never added. Unreachable through the UI itself (the rate form's purity dropdown only lists purities that already exist) - the `404` is a backend safety net for a stale request, not a flow a normal user hits.
- **Tags reference a purity by ID, not by copying its metal/purity as strings.** `Tag.purityId` points at the `MetalPurity` document. This makes renaming a purity safe (every tag referencing it reflects the new name automatically - there's nothing stale to leave behind) and makes the future billing rate-lookup a direct reference (`tag.purityId.ratePerGram`) instead of fragile string matching.
- **Removing a purity is an archive (`active: false`), not a hard delete, by default.** Archived purities disappear from tagging/rate-setting dropdowns but every tag/rate already referencing them keeps working untouched, and they can be un-archived later. A true hard delete is only allowed when nothing currently references that purity (trivial and always-correct to check now that it's a real reference: `Tag.countDocuments({ purityId })`).
- **Every place a purity is chosen by metal must filter to that metal** — explicitly required by the project owner, e.g. selecting Gold must never show Silver's "999" as an option.

### Why this shape (design history)

1. First pass: one hardcoded `METAL_PURITIES` map shared via `src/lib/metals.ts`. Rejected - adding a new purity would need a code change and redeploy, defeating the point of a self-service settings screen for a shopkeeper, not a developer.
2. Second pass: purity as free text on the rate-setting form (type a new one inline). Rejected by the project owner in favor of a dedicated, explicit "Add Purity" step - purity creation and rate-setting are two different tasks done at different times, so they get two different tabs.
3. Third pass: two collections, `Purity` (catalog) and `MetalRate` (current price), kept in sync only by the UI always picking purities from the catalog - never enforced server-side. **Replaced with one collection**: a nullable `ratePerGram` on the same document a purity is created as removes the possibility of the two ever disagreeing, and makes "set rate" naturally an update-only operation on a row guaranteed to already exist.
4. Fourth pass, prompted by "can anyone rename or delete a purity?": with `Tag.purity` as a *copied string*, renaming or deleting a purity in the catalog would silently strand every tag that already used the old value - they'd keep the stale string and permanently lose the ability to match a rate, with nothing visibly broken. **Switched `Tag.purity` to `Tag.purityId`, a real reference** to `MetalPurity` - the standard, durable fix for "a label needs to be renameable without breaking everything that already used it."
5. Fifth pass, on delete specifically: a hard block ("can't delete if any tag ever used it") isn't actually durable either - it just means a purity nobody wants anymore sits in the dropdown forever because of one old tag. **Archive (`active: false`) instead of delete** - hides it from new use, breaks nothing already referencing it, reversible, and a true hard-delete stays available for the case that actually is safe: a purity with zero references (e.g. a typo added seconds ago).

## Data model

```ts
// src/models/MetalPurity.model.ts
{
  metal: string,
  purity: string,
  ratePerGram: number | null,
  active: boolean,          // default true; false = archived, hidden from new use
}  // + timestamps
// unique compound index: { metal: 1, purity: 1 } - one document ever for a
// given combo, active or archived; "adding" a purity matching an archived
// one re-activates it instead of erroring or creating a duplicate.
```

```ts
// src/models/Tag.model.ts (changed)
{
  code: string,
  productName: string,
  purityId: ObjectId,       // ref "MetalPurity" - was: metal: string, purity: string
  grossWtG: number,
  stoneWtG: number,
  netWtG: number,
  status: "tagged" | "sold",
}  // + timestamps
// metal is no longer stored on the tag at all - it's read via
// purityId.metal when populated, so there's exactly one place a tag's
// metal/purity can ever disagree with reality: nowhere.
```

**Migration note:** the project has no real inventory yet - just a handful of dev/test tags created while verifying the tagging feature this session. Cheapest path is to clear those out once this ships rather than write a one-time migration script for throwaway data; flag to the user before doing so.

## Backend

- `src/schemas/purity.schema.ts` — `createPuritySchema` (`metal`, `purity`), `renamePuritySchema` (`purity`), `setPurityActiveSchema` (`active: boolean`).
- `src/schemas/metal-rate.schema.ts` — `setMetalRateSchema` (`metal`, `purity`, `rate_per_gram`).
- `src/server/services/metalPuritiesService.ts`:
  - `listMetalPurities({ metal, includeInactive }?)` — active-only by default (for tagging/rate-setting dropdowns); `includeInactive` for the Add Purity tab's management list, so archived ones are visible to un-archive.
  - `addPurity(input)` — if an **active** `{metal, purity}` already exists, throws `PurityAlreadyExistsError`. If a matching **archived** one exists, re-activates it instead of erroring or duplicating. Otherwise creates fresh with `ratePerGram: null, active: true`.
  - `renamePurity(id, purity)` — re-checks the uniqueness rule above against the new name before updating (same class of check as `addPurity`, just by ID instead of by combo).
  - `setPurityActive(id, active)` — archive/un-archive toggle.
  - `deletePurity(id)` — `Tag.countDocuments({ purityId: id })`; if `> 0`, throws `PurityInUseError` (→ `409`, "N tags use this purity - archive it instead"); otherwise hard-deletes.
  - `setRate(input)` — `findOneAndUpdate({metal, purity}, {ratePerGram}, {new: true})`, no `upsert` — `null` if the combo doesn't exist → route returns `404`.
  - `serializeMetalPurity()`.
- `src/app/api/purities/route.ts` — `GET` 🔒 list (`?metal=`, `?includeInactive=`), `POST` 🔒 add (`409` on active duplicate).
- `src/app/api/purities/[id]/route.ts` — `PATCH` 🔒 (rename via `purity`, and/or archive/un-archive via `active`, in the request body), `DELETE` 🔒 (`409` via `PurityInUseError` if still referenced).
- `src/app/api/metal-rates/route.ts` — `PUT` 🔒 update rate on an existing combo; `404` if it doesn't exist.
- `src/server/services/tagsService.ts` — `createTag()` now takes `purity_id` instead of `metal`/`purity` strings; `serializeTag()` populates `purityId` and flattens the response back to the same `metal`/`purity` string fields the API already returns today, so `GET /api/tags/:code` and friends don't change shape for anything already consuming them.
- `src/schemas/tag.schema.ts` — `createTagSchema`'s `metal`/`purity` fields replaced with `purity_id`.

All routes follow the established `requireAuth()` → `dbConnect()` → validate → service pattern already used by every tags route.

## Frontend

- `src/lib/metals.ts` — just `METALS = ["Gold", "Silver", "Platinum"] as const`.
- `src/features/settings/hooks/useMetalPurities.ts` — list query (`metal`/`includeInactive` params), hits `GET /api/purities`. Reused by `TagForm.tsx`, the rate form's purity dropdown, the rates table, and the Add Purity tab.
- `src/features/settings/hooks/useAddPurity.ts`, `useRenamePurity.ts`, `useSetPurityActive.ts`, `useDeletePurity.ts` — mutations, all invalidate `["metal-purities"]`.
- `src/features/settings/hooks/useSetMetalRate.ts` — mutation, invalidates `["metal-purities"]`, surfaces the `404` through the same `ApiError` path every other form uses.
- `src/app/(app)/settings/page.tsx` — two tabs (local `activeTab` state, no new Tabs primitive needed):
  - **Set Metal Rate**: `MetalRateForm.tsx` (metal + metal-filtered purity selects, active purities only + rate input) + `MetalRatesTable.tsx` (metal, purity, rate - **"Not set"** for `null`, last-updated, Edit reloads a row into the form above).
  - **Add Purity**: `AddPurityForm.tsx` (metal select + purity text input; inline `409` if it already exists active for that metal) + a management list of *all* purities (including archived, muted/greyed), each with Rename / Archive-Unarchive / Delete (Delete only enabled client-side when a quick check shows zero tags reference it - still enforced server-side regardless).
- `src/components/layout/Sidebar.tsx` — move `Settings` out of `comingSoon` into the real `modules` nav, linking to `/settings`.
- `TagForm.tsx` — purity `Select` now sources `useMetalPurities({ metal: watch("metal") })` (active only), submitting the selected purity's `_id` as `purity_id` instead of `metal`+`purity` strings. Resets when metal changes; empty/disabled with a hint if that metal has no active purities yet.
- `TagsTable.tsx` / `TagLabelPreview.tsx` — **no changes needed.** They already consume `tag.metal`/`tag.purity` as flat strings from the API response; `serializeTag()` keeps producing that same shape by populating the reference server-side.

## Not building (yet)

- Billing/invoice integration itself (doesn't exist yet) — this only lays the groundwork (a direct `purityId → ratePerGram` reference) for billing to consume later.
- A UI history/audit log of rate changes or purity renames (still "no history" for rates, per the original decision; renames just overwrite the label).

## Verification plan (once built)

1. `pnpm typecheck` / `pnpm lint` clean.
2. API via curl + a short-lived signed JWT:
   - `POST /api/purities` — 401/422/201/**409 on active duplicate**; confirm `Gold 22K` and `Silver 22K` aren't treated as the same purity; confirm a fresh purity comes back with `rate_per_gram: null, active: true`.
   - Archive a purity (`PATCH .../active: false`), confirm it drops out of `GET /api/purities` default listing but appears with `?includeInactive=true`.
   - `POST` the same `{metal, purity}` again while archived → confirms **re-activation**, not a duplicate or a `409`.
   - Rename a purity (`PATCH .../purity: "..."`) with an existing tag referencing it; re-fetch that tag and confirm it now shows the new name.
   - `DELETE` a purity that a tag references → `409`; `DELETE` one with zero references → succeeds.
   - `PUT /api/metal-rates` on a non-existent combo → `404`; on an existing one → overwrites in place, no duplicate.
   - Clean up any test documents afterward.
3. Manual browser verification: both Settings tabs, archive/rename/delete from the Add Purity tab, the "Not set" rate display, and `TagForm.tsx`'s metal-filtered purity dropdown (Chrome extension unavailable this session for automated checks).
