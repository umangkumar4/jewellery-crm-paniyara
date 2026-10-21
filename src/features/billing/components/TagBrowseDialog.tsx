"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useTags } from "@/features/tagging/hooks/useTags";
import { useAddTagItem } from "@/features/billing/hooks/useAddTagItem";

interface TagBrowseDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TagBrowseDialog({ open, onClose }: TagBrowseDialogProps) {
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const addTagItem = useAddTagItem();

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Only tagged (available) tags - selling something already sold isn't a
  // meaningful choice, so dead ends are hidden from the list entirely
  // rather than shown and rejected on click (see docs/billing-plan.md
  // decision 11).
  const { data, isLoading } = useTags({ page: 1, limit: 20, q: q || undefined, status: "tagged" });

  const handleSelect = (code: string) => {
    addTagItem.mutate(code, { onSuccess: () => onClose() });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Browse Tags">
      <Input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search by product name or code"
        leadingIcon={<Search className="h-4 w-4" />}
        autoFocus
      />

      <div className="mt-4 max-h-80 space-y-1 overflow-y-auto">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : data?.data.length ? (
          data.data.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleSelect(tag.code)}
              disabled={addTagItem.isPending}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition hover:bg-muted disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="font-semibold text-foreground">{tag.product_name}</span>
                <span className="ml-2 text-muted-foreground">{tag.code}</span>
              </span>
              <span className="shrink-0 text-muted-foreground">
                {tag.metal} {tag.purity} · {tag.net_wt_g}g
              </span>
            </button>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No available tags found.</p>
        )}
      </div>
    </Dialog>
  );
}
