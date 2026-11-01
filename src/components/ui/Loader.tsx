import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

export interface LoaderProps {
  className?: string;
  size?: keyof typeof SIZE_CLASS;
}

// Single spinner used everywhere something is loading, so every page shows
// the same loading indicator instead of each one inventing its own.
export function Loader({ className, size = "md" }: LoaderProps) {
  return <Loader2 className={cn(SIZE_CLASS[size], "animate-spin text-muted-foreground", className)} />;
}

export interface LoaderBlockProps extends LoaderProps {
  // Vertical padding for the standalone (non-overlay) case - a table/list's
  // first load, before any data/rows exist to show something underneath.
  padding?: string;
}

export function LoaderBlock({ className, size, padding = "py-12" }: LoaderBlockProps) {
  return (
    <div className={cn("flex items-center justify-center", padding)}>
      <Loader className={className} size={size} />
    </div>
  );
}

// Absolutely-positioned overlay for a background refetch (filter/search/page
// change) over content that's already showing - the wrapping element must
// be `relative` (and have a defined height) for `inset-0` to cover it.
export function LoaderOverlay({ className, size }: LoaderProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60">
      <Loader className={className} size={size} />
    </div>
  );
}
