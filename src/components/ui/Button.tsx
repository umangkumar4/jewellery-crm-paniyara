import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variantClasses = {
  gold: "bg-gold text-gold-foreground shadow-[var(--shadow-gold)] hover:brightness-105 active:brightness-95",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  outline: "border border-border bg-transparent text-foreground hover:bg-muted",
} as const;

const sizeClasses = {
  md: "h-11 px-5 text-sm",
  icon: "h-9 w-9",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "gold", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
