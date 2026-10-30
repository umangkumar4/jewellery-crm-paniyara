"use client";

import { useEffect, useMemo, useState, type UIEvent } from "react";
import { Search } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Loader } from "@/components/ui/Loader";
import { useInfiniteTags } from "@/features/tagging/hooks/useInfiniteTags";
import { useAddTagItem } from "@/features/billing/hooks/useAddTagItem";
import { useBillingStore } from "@/store/useBillingStore";

// Fetch the next page once the list is scrolled within this many pixels of
// the bottom - small enough to feel responsive, large enough that the next
// page (network latency) has a chance to land before the user hits the end.
const SCROLL_FETCH_THRESHOLD_PX = 80;

// Below this many *visible* (post-filter) rows, proactively fetch another
// page instead of waiting for a scroll event - a fetched page of 20 can be
// mostly tags already in the current draft (filtered out below), leaving too
// few rows to even produce a scrollbar, which would otherwise strand the
// user with no way to trigger the next fetch.
const MIN_VISIBLE_TAGS = 10;

interface TagBrowseDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TagBrowseDialog({ open, onClose }: TagBrowseDialogProps) {
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const addTagItem = useAddTagItem();
  const items = useBillingStore((state) => state.items);

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Only tagged (available) tags - selling something already sold isn't a
  // meaningful choice, so dead ends are hidden from the list entirely
  // rather than shown and rejected on click (see docs/billing-plan.md
  // decision 11).
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTags({ limit: 20, q: q || undefined, status: "tagged" });

  const fetchedTags = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);

  // Tags already added to the current (unsaved) draft - hidden from the
  // list for the same reason sold tags are (see comment above): clicking
  // one is a dead end, rejected by useAddTagItem's hasTag() check, so it
  // shouldn't still be sitting there clickable after the first add.
  const addedTagCodes = useMemo(
    () => new Set(items.map((item) => item.tagCode?.toUpperCase()).filter(Boolean)),
    [items],
  );
  const availableTags = fetchedTags.filter((tag) => !addedTagCodes.has(tag.code.toUpperCase()));

  useEffect(() => {
    if (!open || isLoading || isFetchingNextPage || !hasNextPage) return;
    if (availableTags.length < MIN_VISIBLE_TAGS) {
      fetchNextPage();
    }
  }, [open, isLoading, isFetchingNextPage, hasNextPage, availableTags.length, fetchNextPage]);

  const handleSelect = (code: string) => {
    addTagItem.mutate(code, { onSuccess: () => onClose() });
  };

  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasNextPage || isFetchingNextPage) return;
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_FETCH_THRESHOLD_PX) {
      fetchNextPage();
    }
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

      <div className="mt-4 max-h-80 space-y-1 overflow-y-auto" onScroll={handleListScroll}>
        {isLoading || (isFetchingNextPage && availableTags.length === 0) ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : availableTags.length ? (
          <>
            {availableTags.map((tag) => (
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
            ))}
            {isFetchingNextPage ? (
              <div className="flex justify-center py-3">
                <Loader size="sm" />
              </div>
            ) : null}
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No available tags found.</p>
        )}
      </div>
    </Dialog>
  );
}
