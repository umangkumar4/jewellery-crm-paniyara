"use client";

import { useRef, useState } from "react";
import { TagForm } from "@/features/tagging/components/TagForm";
import { TagLabelPreview } from "@/features/tagging/components/TagLabelPreview";
import { PrinterSettingsDialog } from "@/features/tagging/components/PrinterSettingsDialog";
import { TagsTable } from "@/features/tagging/components/TagsTable";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";
import { PageHeader } from "@/components/layout/PageHeader";

export default function TaggingPage() {
  const [previewTag, setPreviewTag] = useState<Tag | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  function handleReprint(tag: Tag) {
    setPreviewTag(tag);
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // If the tag currently shown in the preview panel gets deleted, clear it -
  // otherwise its "reprint" action would sit there pointing at a tag that no
  // longer exists.
  function handleTagDeleted(code: string) {
    setPreviewTag((current) => (current?.code === code ? null : current));
  }

  return (
    <div className="mx-2 max-w-full print:mx-0">
      <PageHeader
        className="print:hidden"
        title="New Tag"
        description="Create an article tag and print its barcode label."
      />

      {/* print:mt-0 - without it this margin stacks with the panel's own
          padding below and pushes the 100mm x 15mm @page content past 15mm
          tall, splitting the single tag across multiple printed pages. */}
      <div ref={previewRef} className="mt-6 print:mt-0 grid gap-6 md:grid-cols-2 md:items-start">
        {/* print:hidden on the wrapper itself, not just its children -
            without it this div still counts as a real (zero-height) grid
            row at print time, and the grid's gap-6 still inserts a gap
            before the Step 2 row, pushing the tag below the page's top
            edge and onto a second page. */}
        <div className="print:hidden">
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Step 1 · Tag Details
          </p>
          <div className="panel p-6">
            <TagForm onCreated={setPreviewTag} />
          </div>
        </div>

        {/* print:static - position:sticky interacting with print pagination
            is a known Chromium bug that fragments/duplicates content across
            pages; this wrapper has no reason to stay sticky once printing,
            so force it off rather than risk that. */}
        <div className="md:sticky md:top-6 print:static">
          <div className="mb-3 flex items-center justify-between gap-3 print:hidden">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Step 2 · Label Preview
            </p>
            <PrinterSettingsDialog />
          </div>
          <TagLabelPreview tag={previewTag} />
        </div>
      </div>

      <div className="mt-8 print:hidden">
        <TagsTable onReprint={handleReprint} onDeleted={handleTagDeleted} />
      </div>
    </div>
  );
}
