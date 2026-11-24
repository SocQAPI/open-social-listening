import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ink";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent-strong text-white border border-accent-strong hover:bg-accent-hover hover:border-accent-hover active:bg-accent-press",
  ink: "bg-ink text-white border border-ink hover:bg-ink-2 hover:border-ink-2",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-subtle active:bg-track",
  ghost: "bg-transparent text-ink-3 border border-transparent hover:bg-subtle hover:text-ink",
  danger: "bg-surface text-[#a5321a] border border-[#b4371c] hover:bg-[#fdf1ee]",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-[13px] rounded-[9px]",
  md: "min-h-11 px-4 text-sm rounded-[10px]",
  lg: "min-h-12 px-[22px] text-[15px] rounded-[10px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap cursor-pointer select-none",
        "transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:active:scale-100",
        variant === "primary" || variant === "ink"
          ? "disabled:border-track disabled:bg-track disabled:text-ink-4"
          : "disabled:opacity-55",
        loading && (variant === "primary" || variant === "ink") && "disabled:border-accent-strong disabled:bg-accent-strong disabled:text-white",
        variant === "primary" || variant === "ink" ? "font-semibold" : "",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
});
