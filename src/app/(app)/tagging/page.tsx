"use client";

import { useRef, useState } from "react";
import { TagForm } from "@/features/tagging/components/TagForm";
import { TagLabelPreview } from "@/features/tagging/components/TagLabelPreview";
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
    <div className="mx-2 max-w-full">
      <PageHeader
        className="print:hidden"
        title="New Tag"
        description="Create an article tag and print its barcode label."
      />

      <div ref={previewRef} className="mt-6 grid gap-6 md:grid-cols-2 md:items-start">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase print:hidden">
            Step 1 · Tag Details
          </p>
          <div className="panel p-6 print:hidden">
            <TagForm onCreated={setPreviewTag} />
          </div>
        </div>

        <div className="md:sticky md:top-6">
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase print:hidden">
            Step 2 · Label Preview
          </p>
          <TagLabelPreview tag={previewTag} />
        </div>
      </div>

      <div className="mt-8 print:hidden">
        <TagsTable onReprint={handleReprint} onDeleted={handleTagDeleted} />
      </div>
    </div>
  );
}
