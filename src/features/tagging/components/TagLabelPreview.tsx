"use client";

import { Printer, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Barcode } from "@/features/tagging/components/Barcode";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";

// Real 100mm x 15mm jewellery tag roll spec: printable area runs 55-70mm,
// the rest is the non-printable tail (adhesive/fold portion), 30-45mm.
// The 60mm printable area itself folds in half at its midpoint, so it's
// really two adjacent 30mm zones (barcode, then details) that become the
// two faces of the folded tag - not one flat zone.
const TAIL_WIDTH_MM = 40;
const BARCODE_ZONE_WIDTH_MM = 30;
const DETAILS_ZONE_WIDTH_MM = 30;

function formatWt(value: number): string {
  return value.toFixed(3);
}

// Whole rupees, not paise, for the tiny printed label specifically - the
// zone has no room for decimals on this row. The precise paise value is
// still shown wherever there's actual space (Tags table, Add Tag form).
function formatStoneAmount(value: number): string {
  return `₹${Math.round(value)}`;
}

// First printable face (after folding): product name (description) +
// barcode + code.
function BarcodeZone({ tag }: { tag: Tag }) {
  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center gap-[0.8mm] rounded-[1mm] border border-[#1f1a12] bg-[#fbf8f1] p-[1.5mm] break-inside-avoid"
      style={{ width: `${BARCODE_ZONE_WIDTH_MM}mm`, height: "15mm" }}
    >
      <p className="w-full truncate text-center font-mono text-[6pt] leading-none font-semibold text-[#1f1a12]">
        {tag.product_name}
      </p>
      <Barcode value={tag.code} className="h-[6mm] w-full" />
      <p className="text-center font-mono text-[5pt] leading-none text-[#6b6457]">{tag.code}</p>
    </div>
  );
}

// Second printable face (after folding): full weight breakdown + stone
// amount - same content/format as validated earlier for the two-zone
// design, since this 30mm zone has at least as much room.
function DetailsZone({ tag }: { tag: Tag }) {
  return (
    <div
      className="flex shrink-0 flex-col justify-center gap-[0.8mm] rounded-[1mm] border border-[#1f1a12] bg-[#fbf8f1] p-[1.5mm] break-inside-avoid"
      style={{ width: `${DETAILS_ZONE_WIDTH_MM}mm`, height: "15mm" }}
    >
      <div className="flex flex-col gap-[0.5mm] font-mono text-[5.5pt] leading-none font-semibold text-[#1f1a12]">
        <div className="flex justify-between">
          <span className="text-[#9c9484]">Gross Wt</span>
          <span>{formatWt(tag.gross_wt_g)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#9c9484]">Stone Wt</span>
          <span>{formatWt(tag.stone_wt_g)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#9c9484]">Net Wt</span>
          <span>{formatWt(tag.net_wt_g)}</span>
        </div>
        {/* Only shown when actually set - a tag that doesn't use this
            field prints exactly as it always has. per_gram prints the
            actual rate entered (total_stone_amount) with a "/g" suffix -
            printing stone_amount (the computed total) with "/g" would
            mislabel a total as a rate. fixed prints the total with an
            "(F)" marker instead. */}
        {tag.stone_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-[#9c9484]">Stone Amt</span>
            <span>
              {tag.stone_amount_method === "per_gram"
                ? `${formatStoneAmount(tag.total_stone_amount)}/g`
                : `${formatStoneAmount(tag.stone_amount)} (F)`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Larger, pixel-sized read-out of the same two faces, purely for
// on-screen legibility - the real faces' fine print (5-6pt) is
// true-to-print-size and hard to read on a monitor. Screen-only
// (print:hidden by the caller); never rendered at print time, so it
// can't affect the actual label output.
function ZoomedFaces({ tag }: { tag: Tag }) {
  return (
    <div className="flex items-stretch gap-4 text-[#1f1a12]">
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-[#e3dcc7] bg-[#fbf8f1] p-4">
        <p className="font-mono text-sm font-semibold">{tag.product_name}</p>
        <Barcode value={tag.code} className="h-10 w-44" />
        <p className="font-mono text-xs text-[#6b6457]">{tag.code}</p>
      </div>
      <div className="flex flex-col justify-center gap-2 rounded-lg border border-[#e3dcc7] bg-[#fbf8f1] p-4">
        <div className="flex flex-col gap-1 font-mono text-sm font-semibold">
          <div className="flex justify-between gap-4">
            <span className="text-[#9c9484]">Gross Wt</span>
            <span>{formatWt(tag.gross_wt_g)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#9c9484]">Stone Wt</span>
            <span>{formatWt(tag.stone_wt_g)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#9c9484]">Net Wt</span>
            <span>{formatWt(tag.net_wt_g)}</span>
          </div>
          {tag.stone_amount > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-[#9c9484]">Stone Amt</span>
              <span>
                {tag.stone_amount_method === "per_gram"
                  ? `${formatStoneAmount(tag.total_stone_amount)}/g`
                  : `${formatStoneAmount(tag.stone_amount)} (F)`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TagLabelPreview({ tag }: { tag: Tag | null }) {
  if (!tag) {
    return (
      <div className="panel flex h-full min-h-72 flex-col items-center justify-center gap-5 p-8 text-center">
        {/* Dashed outline in the same 100mm x 15mm tag shape as the real
            tag below (blank tail + the two faces that fold together), so
            the empty state previews the geometry, not just a generic icon. */}
        <div className="flex" style={{ width: "100mm", height: "15mm" }}>
          <div
            className="h-[15mm] shrink-0 rounded-[1mm] border-2 border-dashed border-muted-foreground/30"
            style={{ width: `${TAIL_WIDTH_MM}mm` }}
          />
          <div
            className="h-[15mm] shrink-0 rounded-[1mm] border-2 border-dashed border-muted-foreground/30"
            style={{ width: `${BARCODE_ZONE_WIDTH_MM}mm` }}
          />
          <div
            className="h-[15mm] shrink-0 rounded-[1mm] border-2 border-dashed border-muted-foreground/30"
            style={{ width: `${DETAILS_ZONE_WIDTH_MM}mm` }}
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <TagIcon className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Create a tag to see its printable label here.
          </p>
        </div>
      </div>
    );
  }

  return (
    // print:p-0 etc strip the panel's own padding/border/shadow at print
    // time - left in place, that padding alone is taller than the 15mm
    // @page height and splits the single tag across multiple printed pages
    // (the panel itself can't be print:hidden, since .tag-print is inside it).
    // print:block - flex containers paginate unreliably in Chromium: even
    // with every sibling correctly at display:none, a flex layout can
    // still reserve a full extra page-height "slot" before the one
    // visible child. Plain block flow doesn't have that problem, and at
    // print time this panel only has one visible child anyway.
    <div className="panel flex flex-col items-center gap-5 p-6 print:block print:gap-0 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <style>{"@page { size: 100mm 15mm; margin: 0; }"}</style>

      <div className="flex flex-col items-center gap-2 print:hidden">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Zoomed preview (on-screen only)
        </p>
        <ZoomedFaces tag={tag} />
      </div>

      {/* 100mm x 15mm tag: TAIL_WIDTH_MM of non-printable blank tail, then
          the 60mm printable area as two adjacent 30mm zones (barcode,
          then details) that become the tag's two faces once folded at
          their shared edge. The dashed outline on the tail is an
          on-screen-only guide (stripped at print time - see the
          .tag-blank rule in globals.css) - the physical paper needs no
          ink there at all.
          True size on screen and on paper (see docs/tag-redesign-plan.md). */}
      {/* break-inside-avoid: without it, Chrome's print pagination will
          slice this row across two pages the instant rendered height is
          even a hair over 15mm (sub-pixel rounding, border widths, etc),
          instead of either fitting it or pushing the whole thing to the
          next page intact. */}
      <div className="tag-print flex break-inside-avoid" style={{ width: "100mm", height: "15mm" }}>
        <div
          className="tag-blank h-[15mm] shrink-0 rounded-[1mm] border-2 border-dashed border-[#c9beac]"
          style={{ width: `${TAIL_WIDTH_MM}mm` }}
        />
        <BarcodeZone tag={tag} />
        <DetailsZone tag={tag} />
      </div>

      <Button type="button" onClick={() => window.print()} className="print:hidden">
        <Printer className="h-4 w-4" />
        Print Label
      </Button>
    </div>
  );
}
