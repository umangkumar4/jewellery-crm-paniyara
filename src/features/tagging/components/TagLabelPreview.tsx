"use client";

import { Printer, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Barcode } from "@/features/tagging/components/Barcode";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";

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
    <div className="panel flex flex-col gap-5 p-6">
      <div className="tag-bw tag-bw-inner mx-auto w-full max-w-xs rounded-lg border border-border bg-card p-5 text-center">
        <p className="font-display text-base text-foreground">{tag.product_name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {tag.metal} · {tag.purity}
        </p>

        <div className="tag-bw-divider my-3 h-px bg-border" />

        <Barcode value={tag.code} className="mx-auto h-10 w-full" />
        <p className="tag-bw-line mt-1 font-mono text-sm tracking-wider text-foreground">{tag.code}</p>

        <div className="tag-bw-divider my-3 h-px bg-border" />

        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          <span>Gross: {tag.gross_wt_g}g</span>
          <span>Net: {tag.net_wt_g}g</span>
        </div>
      </div>

      <Button type="button" onClick={() => window.print()} className="print:hidden">
        <Printer className="h-4 w-4" />
        Print Label
      </Button>
    </div>
  );
}
