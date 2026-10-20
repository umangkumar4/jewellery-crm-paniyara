import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leadingIcon, trailingSlot, ...props }, ref) => {
    return (
      <div className="relative">
        {leadingIcon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          className={cn(
            "h-12 w-full rounded-lg border border-input bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            leadingIcon && "pl-11",
            trailingSlot && "pr-11",
            className,
          )}
          {...props}
        />
        {trailingSlot ? (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3.5">{trailingSlot}</span>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";
