"use client";

import { useState } from "react";
import { TagForm } from "@/features/tagging/components/TagForm";
import { TagLabelPreview } from "@/features/tagging/components/TagLabelPreview";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";

export default function TaggingPage() {
  const [createdTag, setCreatedTag] = useState<Tag | null>(null);

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="font-display text-2xl text-foreground print:hidden">New Tag</h2>
      <p className="mt-1 text-sm text-muted-foreground print:hidden">
        Create an article tag and print its barcode label.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="panel p-6 print:hidden">
          <TagForm onCreated={setCreatedTag} />
        </div>

        <TagLabelPreview tag={createdTag} />
      </div>
    </div>
  );
}
