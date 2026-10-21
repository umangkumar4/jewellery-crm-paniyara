"use client";

import { useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { formatDistanceToNow } from "date-fns";
import { useMetalPurities } from "@/features/settings/hooks/useMetalPurities";
import { formatInr } from "@/lib/formatters";

export function MetalRateCarousel() {
  const { data, isLoading, isError } = useMetalPurities({ includeInactive: false });
  const priced = (data ?? []).filter((purity) => purity.rate_per_gram !== null);
  const [autoScrollPlugin] = useState(() =>
    AutoScroll({ speed: 1, stopOnInteraction: false, stopOnMouseEnter: false }),
  );
  const [emblaRef] = useEmblaCarousel({ align: "start", loop: priced.length > 1 }, [autoScrollPlugin]);

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
