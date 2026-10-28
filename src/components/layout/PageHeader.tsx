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
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div>
        <div className="flex items-center gap-2">
          <BackButton />
          <h2 className="font-display text-2xl text-foreground">{title}</h2>
        </div>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
