# Jewellery Tag Redesign — Plan

> **Status: planning + preview stage, nothing implemented yet.** This doc exists for the same reason `billing-plan.md` does — the physical format (paper stock + printer) is a hardware decision that's expensive to get wrong after tags are bought, so it's worked out and recorded here before touching `TagLabelPreview.tsx`. Current state: `TagLabelPreview.tsx` renders a generic A4-page card with no real print sizing (`@media print` in `globals.css` only swaps colors, there's no `@page` rule at all) — it has never actually been sized for physical tag stock.

---

## What exists today

- `Tag.model.ts` already stores `grossWtG`, `stoneWtG`, `netWtG`, `code`, `productName`, `purityId` — **no schema change needed**, stone weight is already captured, it's just not shown on the label.
- `TagLabelPreview.tsx` shows Gross + Net only (no Stone), a `Barcode` (CODE128 via `jsbarcode`, see `Barcode.tsx`), and no logo. Printed via plain `window.print()` with no page-size CSS.
- The shop logo was added this session at `public/logo.png` (1024×1024 PNG, transparent) — reused here.

## Reference photo (user-supplied)

A blurry close-up of a small rounded tag with a tiny logo mark near the top and a thread/loop running off to the side — this is the standard Indian jewellery **"barbell" / "dumbbell" string tag**: two small printed "paddle" ends joined by a narrow blank waist, which the jeweller folds/ties directly around the piece. It is **not** a plain rectangular label with a separately-tied thread — the waist is part of the same continuous paper stock, which is what makes it fast to attach (no manual threading step).

---

## Decisions made this session

1. **Tag format: continuous barbell/dumbbell roll, 100mm × 15mm per tag.** This is the size Indian barcode/label vendors most consistently stock for jewellery tagging (confirmed via supplier listings — 100×15mm and 100×16mm are the common SKUs; 80×12mm exists as a smaller alternative). Each tag = two ~25mm × 15mm print "paddles" joined by a ~50mm blank waist used to tie around the piece. Picking the most commonly-stocked size means repeat consumable orders won't be a problem later — a custom/rare size would lock the shop into one supplier.
2. **Both paddles print identical content (mirrored), not split across the two ends.** Once tied on, only one paddle is usually visible at a time depending on how the tag sits — duplicating the full info on both sides means staff never have to flip/untie the tag to read something. The alternative (split info across both ends to get more room) was considered and rejected for exactly that reason.
3. **Printer: TSC TTP-244 Pro** (203 dpi, 4-inch thermal-transfer desktop printer, USB) as the primary recommendation — it's the de-facto standard Indian vendors pair with this exact tag stock, inexpensive (~₹13–16k class), and ships with a normal Windows/Mac print driver, so the existing `window.print()` approach keeps working unmodified — no vendor SDK or raw ZPL/EPL generation needed on our end, just correctly-sized CSS.
   - **Thermal-transfer, not direct-thermal, is required.** Jewellery tags sit in a display case/safe for weeks to months; direct-thermal print (like receipt paper) fades with heat/light/time, thermal-transfer (ribbon) doesn't.
   - Noted alternative: Zebra GC420t / ZD230t — same class, pick if ribbon/parts availability for that brand is easier locally. Doesn't change anything on our software side (still a standard driver + CSS-sized print).
4. **Per-paddle field layout — revised to a 2-column split (user decision, supersedes the first 5-row draft below):** 25mm × 15mm usable print area, split left/right rather than stacked top-to-bottom.
   - **Left column: logo only**, vertically centered — identifies the shop at a glance, matches the mark in the user's reference photo. No shop-name text next to it; the logo alone is the brand cue at this size.
   - **Right column, top: barcode** (CODE128, compact height) with its human-readable code printed directly underneath it (standard barcode practice, not an extra row) — this is the functional reason the tag exists, feeding the same `GET /api/tags/:code` lookup billing's "Enter Code" flow already uses.
   - **Right column, bottom: Gross / Stone / Net weights, stacked** (`G`/`S`/`N` label left, value right, one per line) rather than one inline row — the narrower right column after the logo takes its own space doesn't comfortably fit `G 5.230 · S 0.120 · N 5.110` on one line at a legible size. 3 decimal places, matching `formatWt` in `PrintInvoice.tsx`.
   - **Dropped from the face of the tag: tag `code` as its own large line, and purity.** The barcode already encodes the code (scan to pull the rest of the record, including purity, at billing time), and the 2-column split leaves no room for them at a readable size without crowding the weights. If purity on the physical tag turns out to matter in practice, revisit by shrinking the weights block rather than reintroducing a 5-row stack.

   <details><summary>Superseded: original 5-row stacked draft (kept for reference, not used)</summary>

   - Row 1: logo (small, left) + shop initials (right).
   - Row 2: tag `code`, bold.
   - Row 3: purity (e.g. `916 KDM`) — pulled from `purityId` → `MetalPurity`.
   - Row 4: barcode (CODE128, compact height).
   - Row 5: Gross / Stone / Net weights in one inline row.
   </details>
5. **Implementation stays CSS-only, same pattern as `PrintInvoice.tsx`.** That component already proved the approach for this project: a `<style>{"@page { size: ...; margin: ...; }"}</style>` block + a fixed-width wrapper sized in real mm, kept on-screen inside a centered preview and switching to the true page size only under `print:`. The tag redesign will do the same with `@page { size: 100mm 15mm; margin: 0; }`, just at label scale instead of A4.
6. **One tag per physical print, not a sheet of many.** Continuous roll stock feeds one tag at a time (printer auto-advances per label via a gap/black-mark sensor), so each "Print Label" click should send exactly one `@page`-sized document — this is already how `TagLabelPreview.tsx`'s single-tag preview is structured, so no layout change needed there, only the sizing/content.

## Open items (confirm before buying hardware)

- Whether the shop already owns a tag/barcode printer (reuse it if the media width is compatible) or this is a new purchase — the 100×15mm stock needs a printer that accepts ≥4-inch media and ideally a gap-sensor for the dumbbell die-cut; both the TSC and Zebra models above qualify.
- Exact purity source format for Row 3 (`MetalPurity` label text) — needs a quick check against `MetalPurity.model.ts` during implementation, not a blocker for the preview.

## Implementation plan (not started — pending preview sign-off)

1. `TagLabelPreview.tsx` — rebuild the printable markup to the 100×15mm two-paddle layout above, reusing `Barcode.tsx` at a smaller height and adding `/logo.png`.
2. `globals.css` — replace the current color-only `@media print .tag-bw*` rule with a real `@page { size: 100mm 15mm; margin: 0; }` scoped to the tag print view (same pattern `PrintInvoice.tsx` uses inline, kept here since the tag print has no dedicated page route yet — `TaggingPage` reuses `TagLabelPreview` inline).
3. Add Stone weight to the data already flowing into the preview (`Tag` type in `useCreateTag.ts` already carries `stone_wt_g` — just wasn't rendered).
4. Manual test pass: print to PDF at 100mm×15mm and verify against a ruler/real tag before wiring up the actual printer.
