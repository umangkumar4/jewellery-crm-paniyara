import type { ReactNode } from "react";
import { BackButton } from "@/components/layout/BackButton";
import { cn } from "@/lib/utils";

// Single place that lays out "Back" + title (+ optional description/
// actions) so every page gets the identical gap/alignment instead of each
// page hand-rolling its own flex wrapper around BackButton.
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5", className)}>
      <div>
        <BackButton className="mb-2" />
        <h2 className="font-display text-3xl text-foreground">{title}</h2>
        {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
