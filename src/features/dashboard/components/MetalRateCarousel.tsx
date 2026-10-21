"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMetalPurities } from "@/features/settings/hooks/useMetalPurities";
import { formatInr } from "@/lib/formatters";

export function MetalRateCarousel() {
  const { data, isLoading, isError } = useMetalPurities({ includeInactive: false });

  // An added-but-unpriced purity has nothing useful to show on a rate
  // carousel - only purities someone has actually set a rate for appear.
  const priced = (data ?? []).filter((purity) => purity.rate_per_gram !== null);

  // Lazy useState initializer (not useRef) - the plugin instance is read
  // during render to build the embla options array, and refs can't be
  // read during render under the stricter react-hooks lint rules.
  // AutoScroll (not Autoplay) - a continuous slow pixel-by-pixel drift
  // rather than a discrete jump-every-N-seconds animation. Keeps moving
  // on its own regardless of hover/manual nav - no stopOnMouseEnter, and
  // stopOnInteraction: false resumes immediately after a manual drag/click
  // instead of staying stopped.
  const [autoScrollPlugin] = useState(() =>
    AutoScroll({ speed: 1, stopOnInteraction: false, stopOnMouseEnter: false }),
  );
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", loop: priced.length > 1 }, [autoScrollPlugin]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    // Embla's documented React pattern: sync the initial prev/next-disabled
    // state from the just-created instance before any "select" event has
    // fired. See TagForm.tsx/MetalRateForm.tsx for the same precedent of
    // disabling a react-hooks rule where a third-party library's idiomatic
    // usage conflicts with it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (isLoading) {
    return (
      <div>
        <h3 className="font-display text-xl text-foreground">Today&apos;s Metal Rates</h3>
        <div className="mt-3 flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="panel h-28 w-56 shrink-0 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return <div className="panel p-4 text-sm text-destructive">Failed to load metal rates.</div>;
  }

  if (priced.length === 0) {
    return (
      <div className="panel p-4 text-sm text-muted-foreground">
        No metal rates set yet — add one from Settings.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-foreground">Today&apos;s Metal Rates</h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Previous rates"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canScrollPrev}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next rates"
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canScrollNext}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4">
          {priced.map((purity) => (
            <div
              key={purity.id}
              className="panel min-w-0 shrink-0 grow-0 basis-[80%] p-5 transition-shadow hover:shadow-[var(--shadow-gold)] sm:basis-[45%] md:basis-[30%] lg:basis-[22%]"
            >
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {purity.metal} · {purity.purity}
              </div>
              <div className="gold-text mt-2 text-2xl font-semibold">
                {formatInr(purity.rate_per_gram as number)}
                <span className="ml-1 text-sm text-muted-foreground">/g</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Updated {formatDistanceToNow(new Date(purity.updated_at), { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
