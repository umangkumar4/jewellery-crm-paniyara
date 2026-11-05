"use client";

import { useRef, useState } from "react";
import { Printer, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Barcode } from "@/features/tagging/components/Barcode";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";
import { LabelPrinterError } from "@/features/tagging/lib/labelPrinter";
import { readPrinterSettings } from "@/features/tagging/lib/printerSettings";
import { printRawLabel } from "@/features/tagging/lib/qzClient";
import { buildTagLabelTspl, TagLabelError } from "@/features/tagging/lib/tspl";

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
      // print:border-0 - the zone outline is only a screen-side guide for
      // telling the two faces apart in the editor; on real tag stock it's
      // unwanted ink the printer would otherwise lay down as a solid black
      // rounded box (globals.css forces border-color black for .tag-print
      // descendants at print time, so without this the border still shows
      // up on the physical label even though it was never meant to print).
      className="flex shrink-0 flex-col items-center justify-center gap-[0.8mm] rounded-[1mm] border border-[#1f1a12] print:border-0 bg-[#fbf8f1] p-[1.5mm] break-inside-avoid"
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
      // print:border-0 - see BarcodeZone's comment, same unwanted-ink issue.
      className="flex shrink-0 flex-col justify-center gap-[0.8mm] rounded-[1mm] border border-[#1f1a12] print:border-0 bg-[#fbf8f1] p-[1.5mm] break-inside-avoid"
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

// Prints straight to the label printer through QZ Tray. Browser printing is
// only offered after that fails, never opened automatically, so a failure can't
// waste a label on a print nobody asked for. "Sent" rather than "printed" in the
// success message: QZ Tray confirms the job was handed over, not that a label
// came out (a printer that's switched off can still accept a queued job).
function PrintActions({ tag }: { tag: Tag }) {
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  // The button's disabled state only applies after a re-render, so a very fast
  // second click could still get through and waste a second label.
  const printInFlight = useRef(false);

  async function handlePrint() {
    if (printInFlight.current) return;
    printInFlight.current = true;
    setPrinting(true);
    setPrintError(null);
    try {
      // Read at print time, so a change saved on this PC applies to the next label.
      const settings = readPrinterSettings(window.localStorage);
      await printRawLabel(buildTagLabelTspl(tag, settings), settings.printerName);
      toast.success(`Label for ${tag.code} sent to the printer`);
    } catch (error) {
      setPrintError(
        error instanceof LabelPrinterError || error instanceof TagLabelError
          ? error.message
          : "The label couldn't be sent to the printer.",
      );
    } finally {
      printInFlight.current = false;
      setPrinting(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 print:hidden">
      <Button type="button" onClick={handlePrint} disabled={printing}>
        <Printer className="h-4 w-4" />
        {printing ? "Printing..." : "Print Label"}
      </Button>
      {printError && (
        <div role="alert" className="flex max-w-md flex-col items-center gap-3 text-center">
          <p className="text-sm text-destructive">{printError}</p>
          <Button type="button" variant="outline" onClick={() => window.print()}>
            Print with browser instead
          </Button>
        </div>
      )}
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
            style={{ width: `${BARCODE_ZONE_WIDTH_MM}mm` }}
          />
          <div
            className="h-[15mm] shrink-0 rounded-[1mm] border-2 border-dashed border-muted-foreground/30"
            style={{ width: `${DETAILS_ZONE_WIDTH_MM}mm` }}
          />
          <div
            className="h-[15mm] shrink-0 rounded-[1mm] border-2 border-dashed border-muted-foreground/30"
            style={{ width: `${TAIL_WIDTH_MM}mm` }}
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

      {/* 100mm x 15mm tag: the 60mm printable area as two adjacent 30mm
          zones (barcode, then details) that become the tag's two faces
          once folded at their shared edge, followed by TAIL_WIDTH_MM of
          non-printable blank tail at the far end (used to tie/attach the
          tag to the piece). The dashed outline on the tail is an
          on-screen-only guide (stripped at print time - see the
          .tag-blank rule in globals.css) - the physical paper needs no
          ink there at all.
          True size on screen and on paper (see docs/tag-redesign-plan.md). */}
      {/* print:fixed + inset-0: break-inside-avoid alone wasn't enough -
          Chrome was still splitting this row a fraction of a mm past the
          page boundary, because *something* in the ancestor chain (panel
          border/padding/line-height rounding, etc) was adding a sliver of
          height we kept failing to fully zero out one property at a time.
          Taking the row out of normal flow entirely and anchoring it to
          the page's own top-left corner sidesteps that whole class of bug:
          nothing an ancestor contributes can push this box around anymore,
          since it no longer has a position in that flow at all. */}
      <div
        className="tag-print print:fixed print:inset-0 print:m-0 flex break-inside-avoid"
        style={{ width: "100mm", height: "15mm" }}
      >
        <BarcodeZone tag={tag} />
        <DetailsZone tag={tag} />
        <div
          className="tag-blank h-[15mm] shrink-0 rounded-[1mm] border-2 border-dashed border-[#c9beac]"
          style={{ width: `${TAIL_WIDTH_MM}mm` }}
        />
      </div>

      {/* key - a different tag starts clean, not showing the last tag's error. */}
      <PrintActions key={tag.id} tag={tag} />
    </div>
  );
}
