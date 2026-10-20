import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "mb-2 block text-xs font-semibold tracking-wide text-foreground/80 uppercase",
          className,
        )}
        {...props}
      />
    );
  },
);
Label.displayName = "Label";
