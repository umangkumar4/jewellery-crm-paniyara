"use client";

import { Printer, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Barcode } from "@/features/tagging/components/Barcode";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";

function formatWt(value: number): string {
  return value.toFixed(3);
}

// Whole rupees, not paise, for the tiny printed label specifically - the
// paddle has no room for decimals on this row. The precise paise value is
// still shown wherever there's actual space (Tags table, Add Tag form).
function formatStoneAmount(value: number): string {
  return `₹${Math.round(value)}`;
}

// One 25mm x 15mm print "paddle". Both ends of the tag render this same
// component (mirrored) so whichever side ends up facing out once the tag is
// tied onto the piece, the code/weights are still readable without untying
// it - see docs/tag-redesign-plan.md decision 2.
function TagPaddle({ tag }: { tag: Tag }) {
  return (
    <div className="flex h-[15mm] w-[25mm] gap-[1mm] rounded-[1mm] border border-[#1f1a12] bg-[#fbf8f1] p-[1mm]">
      <div className="flex w-[7mm] shrink-0 items-center justify-center border-r border-[#e3dcc7] pr-[1mm]">
        <img src="/logo.png" alt="" className="h-[6mm] w-[6mm] object-contain" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <Barcode value={tag.code} className="h-[4.5mm] w-full" />
          <p className="mt-[0.3mm] text-center font-mono text-[4pt] leading-none text-[#6b6457]">
            {tag.code}
          </p>
        </div>
        <div className="flex flex-col gap-[0.3mm] font-mono text-[5pt] leading-none font-semibold text-[#1f1a12]">
          <div className="flex justify-between">
            <span className="text-[#9c9484]">G</span>
            <span>{formatWt(tag.gross_wt_g)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9c9484]">S</span>
            {/* Combined with amount on this one row, not a 4th row - the
                paddle has no vertical room for one (confirmed design call).
                Amount only shown when actually set, so a tag that doesn't
                use this field prints exactly as it always has. */}
            <span>
              {formatWt(tag.stone_wt_g)}
              {tag.stone_amount > 0 ? ` ${formatStoneAmount(tag.stone_amount)}` : ""}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9c9484]">N</span>
            <span>{formatWt(tag.net_wt_g)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TagLabelPreview({ tag }: { tag: Tag | null }) {
  if (!tag) {
    return (
      <div className="panel flex h-full min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
        <TagIcon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Create a tag to see its printable label here.
        </p>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col items-center gap-5 p-6">
      <style>{"@page { size: 100mm 15mm; margin: 0; }"}</style>

      {/* 100mm x 15mm barbell tag: two 25mm paddles joined by a 50mm blank
          waist - the waist is left unprinted because it's already die-cut
          narrower on the physical roll stock, nothing needs to print there.
          The dashed line through it is an on-screen-only guide (stripped at
          print time below) showing this is one continuous tag, not two -
          without it the blank gap reads as two separate labels.
          True size on screen and on paper (see docs/tag-redesign-plan.md). */}
      <div className="tag-print flex" style={{ width: "100mm", height: "15mm" }}>
        <TagPaddle tag={tag} />
        <div className="tag-waist flex w-[50mm] items-center">
          <div className="w-full border-t border-dashed border-[#c9beac]" />
        </div>
        <TagPaddle tag={tag} />
      </div>

      <Button type="button" onClick={() => window.print()} className="print:hidden">
        <Printer className="h-4 w-4" />
        Print Label
      </Button>
    </div>
  );
}
